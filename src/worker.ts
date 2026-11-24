// trusted-worker: 볼트 폴더를 읽고, 새 폴더·노트를 만드는 곳. 패널은 파일 시스템에 직접 닿지 않는다.
import { execFile, spawn } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { isAbsolute, join, resolve } from 'node:path'
import { noteUrl } from './obsidian.ts'
import { isValidName, noteFileName } from './names.ts'
import { isInside, toEntries } from './tree.ts'

type ListInput = { root: string; dir?: string }
type CreateInput = { root: string; dir: string; kind: 'folder' | 'note'; name: string }
type ReadInput = { root: string; path: string }
const MAX_NOTE_BYTES = 1024 * 1024
// Obsidian 기본 설치 위치 (사용자별 설치). 다른 위치에 설치했다면 여기만 고친다.
// Orca 워커에는 LOCALAPPDATA 가 없을 수 있어서 홈 폴더에서 직접 만든다.
const OBSIDIAN_EXE = join(homedir(), 'AppData', 'Local', 'Programs', 'Obsidian', 'Obsidian.exe')
const OBSIDIAN_CONFIG = join(homedir(), 'AppData', 'Roaming', 'obsidian', 'obsidian.json')

function invalid(message: string): Error {
  return Object.assign(new Error(message), { code: 'invalid_params' })
}

// Obsidian 이 이 폴더를 볼트로 등록했는지 (Obsidian 설정 파일의 vaults 목록)
function registeredInObsidian(root: string): boolean {
  if (!existsSync(OBSIDIAN_CONFIG)) return false
  const { vaults = {} } = JSON.parse(readFileSync(OBSIDIAN_CONFIG, 'utf8')) as { vaults?: Record<string, { path: string }> }
  return Object.values(vaults).some((v) => resolve(v.path).toLowerCase() === root.toLowerCase())
}

export default function activate(orca: {
  panels: {
    handle(name: string, handler: (input: never) => unknown): unknown
  }
}): void {
  orca.panels.handle('vault.list', (input: ListInput) => {
    const root = resolve(input.root)
    const dir = resolve(root, input.dir ?? '.')
    if (!isInside(root, dir)) throw invalid('outside vault')
    const raw = readdirSync(dir, { withFileTypes: true }).map((d) => ({ name: d.name, isDir: d.isDirectory() }))
    return toEntries(dir, raw, join)
  })

  // 같은 이름이 있으면 덮어쓰지 않고 conflict 로 돌려준다 ('wx' 플래그, mkdir 은 기존 폴더에서 실패).
  orca.panels.handle('vault.create', (input: CreateInput) => {
    const root = resolve(input.root)
    const dir = resolve(root, input.dir)
    if (!isInside(root, dir) || !statSync(dir).isDirectory()) throw invalid('not a folder in vault')
    if (!isValidName(input.name)) throw invalid('invalid name')
    const target = join(dir, input.kind === 'note' ? noteFileName(input.name) : input.name.trim())
    try {
      if (input.kind === 'folder') mkdirSync(target)
      else writeFileSync(target, '', { flag: 'wx' })
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
        throw Object.assign(new Error('already exists'), { code: 'conflict' })
      }
      throw error
    }
    return { path: target }
  })

  // 읽기 전용. .md 만, 볼트 안에서만, 1MB 까지만 읽는다 (패널이 큰 파일을 한 번에 받지 않도록).
  // [[이름]] 을 찾는다: 볼트 안에서 이름.md 를 찾는다 (숨김 폴더 제외, 가까운 폴더 먼저).
  // shortcut: 매번 전체를 훑는다, 큰 볼트에서 느려지면 목록을 캐시한다.
  // 검색: 노트 이름과 본문(1MB 이하)에서 찾는다. 결과는 최대 50개.
  // shortcut: 검색할 때마다 전체를 읽는다, 큰 볼트에서 느리면 색인을 둔다.
  orca.panels.handle('vault.search', (input: { root: string; query: string }) => {
    const root = resolve(input.root)
    const q = input.query.trim().toLowerCase()
    const results: { name: string; path: string }[] = []
    if (!q) return { results }
    const queue = [root]
    for (let dir = queue.shift(); dir !== undefined && results.length < 50; dir = queue.shift()) {
      for (const d of readdirSync(dir, { withFileTypes: true })) {
        if (d.name.startsWith('.')) continue
        const full = join(dir, d.name)
        if (d.isDirectory()) queue.push(full)
        else if (d.isFile() && d.name.toLowerCase().endsWith('.md')) {
          let hit = d.name.toLowerCase().includes(q)
          if (!hit && statSync(full).size <= MAX_NOTE_BYTES) hit = readFileSync(full, 'utf8').toLowerCase().includes(q)
          if (hit) results.push({ name: d.name, path: full })
        }
        if (results.length >= 50) break
      }
    }
    return { results }
  })

  // 편집: Obsidian 에 등록된 볼트만 Obsidian 으로 연다. 등록이 없으면 not_found 를 돌려준다.
  orca.panels.handle('vault.editInObsidian', (input: { root: string; path: string }) => {
    const root = resolve(input.root)
    const file = resolve(root, input.path)
    if (!isInside(root, file) || !file.toLowerCase().endsWith('.md')) throw invalid('not a note in vault')
    if (!registeredInObsidian(root)) throw Object.assign(new Error('vault not registered in Obsidian'), { code: 'unavailable' })
    spawn('rundll32.exe', ['url.dll,FileProtocolHandler', noteUrl(root, file)], { detached: true, stdio: 'ignore' }).unref()
    return { ok: true }
  })

  // 그래프: 노트를 점, [[링크]]를 선으로 만든다. 노트는 최대 60개까지만 본다.
  // shortcut: 열 때마다 전체를 읽는다, 큰 볼트에서 느리면 캐시한다.
  orca.panels.handle('vault.graph', (input: { root: string }) => {
    const root = resolve(input.root)
    const files: { name: string; path: string; text: string }[] = []
    const queue = [root]
    for (let dir = queue.shift(); dir !== undefined && files.length < 60; dir = queue.shift()) {
      for (const d of readdirSync(dir, { withFileTypes: true })) {
        if (d.name.startsWith('.')) continue
        const full = join(dir, d.name)
        if (d.isDirectory()) queue.push(full)
        else if (d.isFile() && d.name.toLowerCase().endsWith('.md') && files.length < 60) {
          const text = statSync(full).size <= MAX_NOTE_BYTES ? readFileSync(full, 'utf8') : ''
          files.push({ name: d.name, path: full, text })
        }
      }
    }
    const index = new Map(files.map((f, i) => [f.name.slice(0, -3).toLowerCase(), i]))
    const edges: [number, number][] = []
    files.forEach((f, i) => {
      for (const m of f.text.matchAll(/\[\[([^\]]+)\]\]/g)) {
        const j = index.get(m[1].split('|')[0].split('#')[0].trim().toLowerCase())
        if (j !== undefined && j !== i) edges.push([i, j])
      }
    })
    return { nodes: files.map(({ name, path }) => ({ name, path })), edges }
  })

  orca.panels.handle('vault.findNote', (input: { root: string; name: string }) => {
    const root = resolve(input.root)
    const target = `${input.name}.md`.toLowerCase()
    const queue = [root]
    for (let dir = queue.shift(); dir !== undefined; dir = queue.shift()) {
      for (const d of readdirSync(dir, { withFileTypes: true })) {
        if (d.isFile() && d.name.toLowerCase() === target) return { path: join(dir, d.name) }
        if (d.isDirectory() && !d.name.startsWith('.')) queue.push(join(dir, d.name))
      }
    }
    return { path: null }
  })

  orca.panels.handle('vault.read', (input: ReadInput) => {
    const root = resolve(input.root)
    const file = resolve(root, input.path)
    if (!isInside(root, file) || !file.toLowerCase().endsWith('.md')) throw invalid('not a note in vault')
    const stat = statSync(file)
    if (!stat.isFile()) throw invalid('not a file')
    if (stat.size > MAX_NOTE_BYTES) throw Object.assign(new Error('note too large'), { code: 'too_large' })
    return { text: readFileSync(file, 'utf8') }
  })

  orca.panels.handle('obsidian.status', () => ({ installed: existsSync(OBSIDIAN_EXE) }))

  // 폴더 선택 창(Windows)을 띄우고 고른 경로를 돌려준다. 취소하면 path 는 null. 스크립트는 고정 문자열이다.
  // 폴더 선택 창: 창이 뜨면 패널에 picker.opened 를 보내 스피너를 멈추게 하고, 고른 경로를 돌려준다.
  orca.panels.handle('vault.pickFolder', (_input: never, ctx: { panel: { id: string } }) => new Promise((done, fail) => {
    // 숨긴 최상위 창을 소유자로 띄워야 폴더 선택 창이 Orca 뒤로 가지 않고 바로 열린다
    // 출력 인코딩을 UTF-8 로 맞춘다: 기본값(CP949)이면 한글 경로가 워커에서 깨진다
    const script = "[Console]::OutputEncoding = [Text.Encoding]::UTF8; Add-Type -AssemblyName System.Windows.Forms; $f = New-Object System.Windows.Forms.Form; $f.TopMost = $true; $f.ShowInTaskbar = $false; $f.Opacity = 0; $f.Show(); $f.Activate(); $d = New-Object System.Windows.Forms.FolderBrowserDialog; [Console]::Out.WriteLine('OPEN'); [Console]::Out.Flush(); if ($d.ShowDialog($f) -eq 'OK') { $d.SelectedPath }; $f.Close()"
    const child = spawn('powershell.exe', ['-NoProfile', '-STA', '-Command', script], { windowsHide: true })
    let out = ''
    let opened = false
    child.stdout.on('data', (chunk: Buffer) => {
      out += chunk.toString()
      if (!opened && out.includes('OPEN')) {
        opened = true
        orca.panels.post('picker.opened', {}, { panel: ctx.panel.id })
      }
    })
    child.on('error', fail)
    child.on('close', () => done({ path: out.replace('OPEN', '').trim() || null }))
  }))


}
