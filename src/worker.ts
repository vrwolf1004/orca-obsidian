// trusted-worker: 볼트 폴더를 읽고, 새 폴더·노트를 만드는 곳. 패널은 파일 시스템에 직접 닿지 않는다.
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { isValidName, noteFileName } from './names.ts'
import { isInside, toEntries } from './tree.ts'

type ListInput = { root: string; dir?: string }
type CreateInput = { root: string; dir: string; kind: 'folder' | 'note'; name: string }
type ReadInput = { root: string; path: string }
const MAX_NOTE_BYTES = 1024 * 1024
// Obsidian 기본 설치 위치 (사용자별 설치). 다른 위치에 설치했다면 여기만 고친다.
// Orca 워커에는 LOCALAPPDATA 가 없을 수 있어서 홈 폴더에서 직접 만든다.
const OBSIDIAN_EXE = join(homedir(), 'AppData', 'Local', 'Programs', 'Obsidian', 'Obsidian.exe')

function invalid(message: string): Error {
  return Object.assign(new Error(message), { code: 'invalid_params' })
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

}
