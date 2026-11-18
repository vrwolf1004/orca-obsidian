// 패널: 볼트 등록·선택·삭제, 선택한 볼트의 노트 목록. 상태는 storage:own 에 둔다.
import { addVault, emptyState, removeVault, selectVault, type VaultState } from './vaults.ts'
import type { Entry } from './tree.ts'
import { parseBlocks, parseInline, type Block, type Inline } from './markdown.ts'
import { cycleLang, setLang, t, type Key } from './i18n.ts'
import { highlight } from './highlight.ts'

type Orca = {
  storage: { get(key: string): Promise<unknown>; set(key: string, value: unknown): Promise<void> }
  // worker(src/worker.ts)의 vault.list 를 부른다. 파일 목록은 여기서만 받는다.
  plugin: { request(name: string, input: unknown): Promise<unknown> }
}
const orca = (window as unknown as { orca: Orca }).orca
const STATE_KEY = 'vaultState'
const LANG_KEY = 'lang'
const PALETTE = ['#7c5cff', '#22b8a6', '#f59e0b', '#ef6f8a', '#3b9eff', '#84cc16']

const list = document.getElementById('vault-list') as HTMLUListElement
const form = document.getElementById('vault-form') as HTMLFormElement
const input = document.getElementById('vault-path') as HTMLInputElement
const status = document.getElementById('status') as HTMLParagraphElement
const notes = document.getElementById('notes') as HTMLElement
const tree = document.getElementById('tree') as HTMLUListElement
const notesVault = document.getElementById('notes-vault') as HTMLParagraphElement

let state: VaultState = emptyState
// 삭제 확인 중인 볼트 경로. null 이면 확인 줄이 없다.
let pendingRemove: string | null = null
// 펼친 폴더 경로. 다시 그려도 펼침 상태가 유지된다.
const expanded = new Set<string>()
// 새 폴더·노트 입력 중인 위치와 종류. null 이면 입력줄이 없다.
let creating: { dir: string; kind: 'folder' | 'note' } | null = null
const menu = document.getElementById('ctx') as HTMLDivElement

async function save(next: VaultState): Promise<void> {
  state = next
  await orca.storage.set(STATE_KEY, next)
  render()
}

// Lucide 아이콘 경로 (ISC 라이선스). 값이 들어가지 않으므로 DOM API 로 만든다.
const X_ICON = ['M18 6 6 18', 'm6 6 12 12']
const CHEVRON = ['m9 18 6-6-6-6']
const FOLDER = ['M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z']
const FOLDER_OPEN = ['m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.93a2 2 0 0 1 1.66.9l.82 1.2a2 2 0 0 0 1.66.9H18a2 2 0 0 1 2 2v2']
const FILE_TEXT = ['M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z', 'M14 2v4a2 2 0 0 0 2 2h4', 'M10 9H8', 'M16 13H8', 'M16 17H8']

function svgIcon(paths: string[], className = ''): SVGSVGElement {
  const NS = 'http://www.w3.org/2000/svg'
  const svg = document.createElementNS(NS, 'svg')
  svg.setAttribute('viewBox', '0 0 24 24')
  svg.setAttribute('aria-hidden', 'true')
  svg.setAttribute('focusable', 'false')
  if (className) svg.setAttribute('class', className)
  for (const d of paths) {
    const path = document.createElementNS(NS, 'path')
    path.setAttribute('d', d)
    svg.append(path)
  }
  return svg
}

// Orca 가 거절할 때 붙이는 code 를 읽는다 (없으면 빈 문자열).
function reasonOf(error: unknown): string {
  return (error as { code?: string })?.code ?? ''
}

function say(message: string): void {
  status.textContent = message
}

function render(): void {
  list.replaceChildren()
  if (state.vaults.length === 0) say(t('no_vaults'))
  else say('')
  // 볼트마다 다른 색 (순서대로 돌려 쓴다). 색은 CSS 변수 --dot 으로 넘긴다.
  state.vaults.forEach((vault, index) => {
    const li = document.createElement('li')
    li.style.setProperty('--dot', PALETTE[index % PALETTE.length])

    if (pendingRemove === vault.path) {
      // 삭제 전 확인: 목록에서만 빼고 폴더는 건드리지 않는다는 점을 함께 적는다.
      li.classList.add('confirm')
      const text = document.createElement('span')
      text.className = 'confirm-text'
      text.textContent = t('confirm_remove', { name: vault.name })
      const yes = document.createElement('button')
      yes.type = 'button'
      yes.className = 'confirm-yes'
      yes.textContent = t('btn_remove')
      yes.addEventListener('click', () => {
        pendingRemove = null
        void save(removeVault(state, vault.path))
      })
      const no = document.createElement('button')
      no.type = 'button'
      no.className = 'confirm-no'
      no.textContent = t('btn_cancel')
      no.addEventListener('click', () => {
        pendingRemove = null
        render()
      })
      li.append(text, yes, no)
      list.append(li)
      return
    }

    const pick = document.createElement('button')
    pick.type = 'button'
    pick.className = 'pick'
    pick.textContent = vault.name
    pick.title = vault.path
    pick.setAttribute('aria-pressed', String(vault.path === state.current))
    pick.addEventListener('click', () => {
      pendingRemove = null
      void save(selectVault(state, vault.path))
    })

    const remove = document.createElement('button')
    remove.type = 'button'
    remove.className = 'remove'
    remove.append(svgIcon(X_ICON))
    remove.title = t('remove')
    remove.setAttribute('aria-label', t('remove_named', { name: vault.name }))
    remove.addEventListener('click', () => {
      pendingRemove = vault.path
      render()
    })

    li.append(pick, remove)
    list.append(li)
  })
  void renderTree()
}

// 선택한 볼트의 최상위 노트와 폴더. 펼친 폴더는 expanded 에 기억해 다시 그려도 유지된다.
async function renderTree(): Promise<void> {
  tree.replaceChildren()
  const current = state.vaults.find((v) => v.path === state.current)
  notes.hidden = !current
  // 한 줄: 볼트 이름, 콜론, 실제 폴더 경로 (경로는 흐리게)
  notesVault.replaceChildren()
  if (current) {
    const name = document.createElement('span')
    name.className = 'nv-name'
    name.textContent = current.name
    const path = document.createElement('span')
    path.className = 'nv-path'
    path.textContent = ` : ${current.path}`
    path.title = current.path
    notesVault.append(name, path)
  }
  if (!current) return
  try {
    tree.append(...(await buildLevel(current.path, current.path)))
  } catch {
    say(t('cannot_read_vault'))
  }
}

// 한 폴더의 항목들. 새 항목 입력줄이 이 폴더에 있으면 맨 위에 넣는다.
async function buildLevel(root: string, dir: string): Promise<HTMLElement[]> {
  const items: HTMLElement[] = []
  if (creating?.dir === dir) items.push(newItemRow(root, dir, creating.kind))
  const entries = await listDir(root, dir)
  for (const entry of entries) items.push(await treeItem(root, entry))
  return items
}

async function fillChildren(li: HTMLLIElement, root: string, dir: string): Promise<void> {
  try {
    const ul = document.createElement('ul')
    ul.append(...(await buildLevel(root, dir)))
    li.append(ul)
  } catch {
    say(t('cannot_open_folder'))
  }
}

async function listDir(root: string, dir: string): Promise<Entry[]> {
  return (await orca.plugin.request('vault.list', { root, dir })) as Entry[]
}

async function treeItem(root: string, entry: Entry): Promise<HTMLLIElement> {
  const li = document.createElement('li')
  li.dataset.path = entry.path
  li.dataset.kind = entry.dir ? 'folder' : 'note'
  const row = document.createElement('button')
  row.type = 'button'
  row.className = entry.dir ? 'node folder' : 'node note'
  row.title = entry.path
  // Windows 탐색기처럼: 폴더는 화살표 + 닫힌/열린 폴더 아이콘, 노트는 문서 아이콘.
  if (entry.dir) {
    row.append(svgIcon(CHEVRON, 'chev'), svgIcon(FOLDER, 'ico ico-closed'), svgIcon(FOLDER_OPEN, 'ico ico-open'))
  } else {
    const spacer = document.createElement('span')
    spacer.className = 'chev-spacer'
    row.append(spacer, svgIcon(FILE_TEXT, 'ico'))
  }
  const label = document.createElement('span')
  label.className = 'label'
  label.textContent = entry.name
  row.append(label)
  li.append(row)
  if (!entry.dir) {
    row.addEventListener('click', () => void openNote(root, entry))
    return li
  }

  const isOpen = expanded.has(entry.path)
  row.setAttribute('aria-expanded', String(isOpen))
  row.addEventListener('click', () => {
    if (expanded.has(entry.path)) expanded.delete(entry.path)
    else expanded.add(entry.path)
    void renderTree()
  })
  if (isOpen) await fillChildren(li, root, entry.path)
  return li
}

// 새 폴더·노트 입력줄. Enter 로 만들고, Esc 나 빈 칸에서 떠나면 취소한다.
function newItemRow(root: string, dir: string, kind: 'folder' | 'note'): HTMLLIElement {
  const li = document.createElement('li')
  const row = document.createElement('div')
  row.className = 'node new'
  const spacer = document.createElement('span')
  spacer.className = 'chev-spacer'
  row.append(spacer, svgIcon(kind === 'folder' ? FOLDER : FILE_TEXT, 'ico'))
  const field = document.createElement('input')
  field.type = 'text'
  field.className = 'new-input'
  field.placeholder = kind === 'folder' ? t('folder_placeholder') : t('note_placeholder')
  field.setAttribute('aria-label', field.placeholder)
  field.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      void commitCreate(root, dir, field.value)
    } else if (event.key === 'Escape') {
      creating = null
      void renderTree()
    }
  })
  field.addEventListener('blur', () => {
    if (!field.value.trim()) {
      creating = null
      void renderTree()
    }
  })
  row.append(field)
  li.append(row)
  return li
}

async function commitCreate(root: string, dir: string, name: string): Promise<void> {
  const kind = creating?.kind
  if (!kind) return
  const trimmed = name.trim()
  if (!trimmed) {
    say(t('enter_name'))
    return
  }
  try {
    await orca.plugin.request('vault.create', { root, dir, kind, name: trimmed })
    creating = null
    expanded.add(dir)
    say(t(kind === 'folder' ? 'folder_created' : 'note_created'))
    await renderTree()
  } catch (error) {
    say(t(reasonOf(error) === 'conflict' ? 'err_exists' : 'err_create'))
  }
}

// 우클릭 메뉴: 폴더 위에서 누르면 그 폴더, 노트 위에서는 노트가 있는 폴더, 빈 곳에서는 볼트 최상위.
let menuTarget: string | null = null
notes.addEventListener('contextmenu', (event) => {
  const current = state.vaults.find((v) => v.path === state.current)
  if (!current) return
  event.preventDefault()
  const target = (event.target as HTMLElement).closest<HTMLLIElement>('li[data-path]')
  const folder =
    target?.dataset.kind === 'folder'
      ? target
      : target?.parentElement?.closest<HTMLLIElement>('li[data-kind="folder"]')
  menuTarget = folder?.dataset.path ?? current.path
  menu.style.left = `${event.clientX}px`
  menu.style.top = `${event.clientY}px`
  menu.hidden = false
})

async function startCreate(kind: 'folder' | 'note'): Promise<void> {
  if (!menuTarget) return
  creating = { dir: menuTarget, kind }
  expanded.add(menuTarget)
  await renderTree()
  tree.querySelector<HTMLInputElement>('.new-input')?.focus()
}

for (const item of menu.querySelectorAll<HTMLButtonElement>('button')) {
  item.addEventListener('click', () => {
    menu.hidden = true
    startCreate(item.dataset.kind === 'folder' ? 'folder' : 'note')
  })
}
document.addEventListener('click', (event) => {
  if (!menu.contains(event.target as Node)) menu.hidden = true
})
// Ctrl+H: 도움말 열기·닫기. F2: 언어 바꾸기. Esc: 메뉴와 도움말을 닫는다.
const help = document.getElementById('help') as HTMLElement
function toggleHelp(): void {
  help.hidden = !help.hidden
}
document.getElementById('help-close')?.addEventListener('click', toggleHelp)
help.addEventListener('click', (event) => {
  if (event.target === help) toggleHelp()
})
document.addEventListener('keydown', (event) => {
  if (event.ctrlKey && event.key.toLowerCase() === 'h') {
    event.preventDefault()
    toggleHelp()
  } else if (event.key === 'F2') {
    event.preventDefault()
    void orca.storage.set(LANG_KEY, cycleLang())
    refreshText()
  } else if (event.key === 'Escape') {
    menu.hidden = true
    help.hidden = true
  }
})


form.addEventListener('submit', (event) => {
  event.preventDefault()
  const result = addVault(state, input.value)
  if (!result.ok) {
    say(result.reason === 'empty' ? t('enter_path') : t('duplicate'))
    return
  }
  input.value = ''
  void save(result.state)
})

// 노트 보기 (읽기 전용). 내용은 worker 가 읽고, 여기서는 텍스트 조각으로만 그린다.
const viewer = document.getElementById('viewer') as HTMLElement
const viewerTitle = document.getElementById('viewer-title') as HTMLSpanElement
const viewerBody = document.getElementById('viewer-body') as HTMLElement
document.getElementById('viewer-close')?.addEventListener('click', () => (viewer.hidden = true))

let obsidianInstalled = false
const obsidianStatus = document.getElementById('obsidian-status') as HTMLParagraphElement

async function openNote(root: string, entry: Entry): Promise<void> {
  try {
    const { text } = (await orca.plugin.request('vault.read', { root, path: entry.path })) as { text: string }
    viewerTitle.textContent = entry.name
    viewerBody.replaceChildren(...renderBlocks(parseBlocks(text)))
    viewer.hidden = false
    viewer.scrollIntoView({ block: 'start' })
  } catch (error) {
    console.error('open note failed', error)
    say(t('err_note'))
  }
}

function renderBlocks(blocks: Block[]): HTMLElement[] {
  return blocks.map((block) => {
    if (block.kind === 'heading') {
      const h = document.createElement(`h${Math.min(block.level, 6)}`)
      h.append(...renderInline(block.text))
      return h
    }
    if (block.kind === 'list') {
      const ul = document.createElement('ul')
      for (const item of block.items) {
        const li = document.createElement('li')
        if (item.checked !== null) {
          // 체크박스는 실제 상자로 그린다 (읽기 전용이라 disabled)
          li.classList.add('task')
          const box = document.createElement('input')
          box.type = 'checkbox'
          box.checked = item.checked
          box.disabled = true
          li.append(box)
        }
        li.append(...renderInline(item.text))
        ul.append(li)
      }
      return ul
    }
    if (block.kind === 'code') {
      const pre = document.createElement('pre')
      for (const token of highlight(block.text, block.lang)) {
        if (token.kind === 'plain') {
          pre.append(token.text)
          continue
        }
        const span = document.createElement('span')
        span.className = `tok-${token.kind}`
        span.textContent = token.text
        pre.append(span)
      }
      return pre
    }
    if (block.kind === 'table') {
      const table = document.createElement('table')
      const head = table.createTHead().insertRow()
      for (const cell of block.header) head.append(cellWith('th', cell))
      const body = table.createTBody()
      for (const row of block.rows) {
        const tr = body.insertRow()
        for (const cell of row) tr.append(cellWith('td', cell))
      }
      return table
    }
    const p = document.createElement('p')
    p.append(...renderInline(block.text))
    return p
  })
}

function cellWith(tag: 'th' | 'td', text: string): HTMLTableCellElement {
  const cell = document.createElement(tag)
  cell.append(...renderInline(text))
  return cell
}

function renderInline(text: string): Node[] {
  return parseInline(text).map((part: Inline) => {
    if (part.kind === 'text') return document.createTextNode(part.text)
    const el = document.createElement(part.kind === 'strong' ? 'strong' : part.kind === 'em' ? 'em' : part.kind === 'code' ? 'code' : 'span')
    if (part.kind === 'wiki' || part.kind === 'tag') el.className = part.kind
    el.textContent = part.text
    return el
  })
}

// data-i18n 이 붙은 HTML 문구를 브라우저 언어로 바꾼다.
function applyLocale(): void {
  for (const el of document.querySelectorAll<HTMLElement>('[data-i18n]')) el.textContent = t(el.dataset.i18n as Key)
  for (const el of document.querySelectorAll<HTMLElement>('[data-i18n-title]')) el.title = t(el.dataset.i18nTitle as Key)
  for (const el of document.querySelectorAll<HTMLElement>('[data-i18n-aria]')) el.setAttribute('aria-label', t(el.dataset.i18nAria as Key))
}

// 언어를 바꾼 뒤 화면 문구를 모두 다시 그린다.
function refreshText(): void {
  applyLocale()
  obsidianStatus.textContent = t(obsidianInstalled ? 'obs_installed' : 'obs_missing')
  obsidianStatus.classList.toggle('missing', !obsidianInstalled)
  render()
}

void (async () => {
  const lang = await orca.storage.get(LANG_KEY)
  if (typeof lang === 'string') setLang(lang)
  const { installed } = (await orca.plugin.request('obsidian.status', {})) as { installed: boolean }
  obsidianInstalled = installed
  obsidianStatus.hidden = false
  const saved = (await orca.storage.get(STATE_KEY)) as VaultState | null
  if (saved) state = saved
  refreshText()
})()
