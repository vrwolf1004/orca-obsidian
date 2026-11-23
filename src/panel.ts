// 패널: 볼트 등록·선택·삭제, 선택한 볼트의 노트 목록. 상태는 storage:own 에 둔다.
import { addVault, emptyState, removeVault, selectVault, type VaultState } from './vaults.ts'
import type { Entry } from './tree.ts'
import { parseBlocks, parseInline, type Block, type Inline } from './markdown.ts'
import { cycleLang, setLang, t, type Key } from './i18n.ts'
import { highlight } from './highlight.ts'

type Orca = {
  storage: { get(key: string): Promise<unknown>; set(key: string, value: unknown): Promise<void> }
  // worker(src/worker.ts)의 vault.list 를 부른다. 파일 목록은 여기서만 받는다.
  plugin: { request(name: string, input: unknown): Promise<unknown>; on(event: string, handler: () => void): void }
}
const orca = (window as unknown as { orca: Orca }).orca
const STATE_KEY = 'vaultState'
const LANG_KEY = 'lang'
const PALETTE = ['#7c5cff', '#22b8a6', '#f59e0b', '#ef6f8a', '#3b9eff', '#84cc16']

const list = document.getElementById('vault-list') as HTMLUListElement
const status = document.getElementById('status') as HTMLParagraphElement
const notes = document.getElementById('notes') as HTMLElement
const tree = document.getElementById('tree') as HTMLUListElement
const notesTitle = document.getElementById('notes-title') as HTMLElement
const notesPath = document.getElementById('notes-path') as HTMLParagraphElement
// 바인더 탭: VAULTS / NOTES 중 하나만 보인다
function showTab(name: string): void {
  for (const tab of document.querySelectorAll<HTMLButtonElement>('.binder-tab')) tab.setAttribute('aria-selected', String(tab.dataset.tab === name))
  for (const panel of ['vaults', 'search', 'notes']) (document.getElementById(`tab-${panel}`) as HTMLElement).hidden = panel !== name
}

// 그래프 탭: 노트를 점, [[링크]]를 선으로 원형에 배치한다. 점을 누르면 그 노트를 연다.
async function renderGraph(): Promise<void> {
  const svg = document.getElementById('graph') as unknown as SVGSVGElement
  svg.replaceChildren()
  const current = state.vaults.find((v) => v.path === state.current)
  if (!current) return
  const { nodes, edges } = (await orca.plugin.request('vault.graph', { root: current.path })) as { nodes: Entry[]; edges: [number, number][] }
  const NS = 'http://www.w3.org/2000/svg'
  const pos = nodes.map((_, i) => {
    const angle = (2 * Math.PI * i) / nodes.length - Math.PI / 2
    return { x: 160 + 130 * Math.cos(angle), y: 160 + 130 * Math.sin(angle) }
  })
  for (const [a, b] of edges) {
    const line = document.createElementNS(NS, 'line')
    line.setAttribute('x1', String(pos[a].x))
    line.setAttribute('y1', String(pos[a].y))
    line.setAttribute('x2', String(pos[b].x))
    line.setAttribute('y2', String(pos[b].y))
    line.setAttribute('class', 'graph-edge')
    svg.append(line)
  }
  nodes.forEach((node, i) => {
    const g = document.createElementNS(NS, 'g')
    g.setAttribute('class', 'graph-node')
    const dot = document.createElementNS(NS, 'circle')
    dot.setAttribute('cx', String(pos[i].x))
    dot.setAttribute('cy', String(pos[i].y))
    dot.setAttribute('r', '6')
    dot.setAttribute('fill', PALETTE[i % PALETTE.length])
    const label = document.createElementNS(NS, 'text')
    label.setAttribute('x', String(pos[i].x))
    label.setAttribute('y', String(pos[i].y + 18))
    label.setAttribute('text-anchor', 'middle')
    label.textContent = node.name.replace(/\.md$/i, '')
    g.append(dot, label)
    g.addEventListener('click', () => void openNote(current.path, node))
    svg.append(g)
  })
}
// 접기: 탭을 누르면 펼쳐서 그 탭을 보여 주고, 열린 탭을 한 번 더 누르면 접는다.
const binder = document.querySelector('.binder') as HTMLElement
function setCollapsed(on: boolean): void {
  binder.classList.toggle('collapsed', on)
}
// MD 화면을 누르면 열려 있던 탭 패널을 닫는다
document.getElementById('viewer')?.addEventListener('click', () => setCollapsed(true))
for (const tab of document.querySelectorAll<HTMLButtonElement>('.binder-tab')) {
  tab.addEventListener('click', () => {
    const name = tab.dataset.tab ?? 'vaults'
    if (binder.classList.contains('collapsed')) {
      setCollapsed(false)
      showTab(name)
    } else if (tab.getAttribute('aria-selected') === 'true') {
      setCollapsed(true)
    } else {
      showTab(name)
    }
  })
}

const searchInput = document.getElementById('search-input') as HTMLInputElement
const searchResults = document.getElementById('search-results') as HTMLUListElement
let searchTimer = 0
searchInput.addEventListener('input', () => {
  clearTimeout(searchTimer)
  searchTimer = window.setTimeout(() => void runSearch(), 300)
})

// 입력이 멈추면 선택한 볼트에서 노트 이름과 본문을 찾는다
async function runSearch(): Promise<void> {
  searchResults.replaceChildren()
  const current = state.vaults.find((v) => v.path === state.current)
  const query = searchInput.value.trim()
  if (!current || !query) return
  const { results } = (await orca.plugin.request('vault.search', { root: current.path, query })) as { results: Entry[] }
  if (results.length === 0) {
    const li = document.createElement('li')
    li.className = 'no-results'
    li.textContent = t('no_results')
    searchResults.append(li)
    return
  }
  for (const r of results) {
    const li = document.createElement('li')
    const row = document.createElement('button')
    row.type = 'button'
    row.className = 'node note'
    row.title = r.path
    row.textContent = r.name
    row.addEventListener('click', () => void openNote(current.path, { name: r.name, path: r.path, dir: false }))
    li.append(row)
    searchResults.append(li)
  }
}

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
  if (state.vaults.length === 0) {
    // 볼트가 없으면 바인더를 펼쳐 VAULTS 를 먼저 보여 준다
    setCollapsed(false)
    showTab('vaults')
    say(t('no_vaults'))
  }
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
    if (vault.path === state.current) {
      // 현재 볼트는 항목 안에 경로도 함께 보인다
      const where = document.createElement('span')
      where.className = 'pick-path'
      where.textContent = ` : ${vault.path}`
      pick.append(where)
    }
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
  // 볼트 이름은 노란색으로 강조한다
  notesTitle.replaceChildren('Notes')
  if (current) {
    const name = document.createElement('span')
    name.textContent = ` - ${current.name}`
    name.style.color = '#f59e0b'
    notesTitle.append(name)
  }
  notesPath.textContent = current?.path ?? ''
  void renderGraph()
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
    const chev = document.createElement('span')
    chev.className = 'chev'
    row.append(chev, svgIcon(FOLDER, 'ico ico-closed'), svgIcon(FOLDER_OPEN, 'ico ico-open'))
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


// 입력한 경로나 폴더 선택 창에서 고른 경로를 볼트로 추가한다.
function addPath(path: string): void {
  const result = addVault(state, path)
  if (!result.ok) {
    say(result.reason === 'empty' ? t('enter_path') : t('duplicate'))
    return
  }
  void save(result.state)
}

// 폴더 선택 창이 열려 있는 동안 버튼에 스피너를 돌린다 (끝나면 멈춘다)
const pickButton = document.getElementById('pick-folder') as HTMLButtonElement
// 폴더 선택 창이 뜨면 스피너를 멈춘다 (워커가 picker.opened 를 보낸다)
orca.plugin.on('picker.opened', () => pickButton.classList.remove('busy'))
pickButton.addEventListener('click', async () => {
  pickButton.classList.add('busy')
  pickButton.disabled = true
  try {
    const { path } = (await orca.plugin.request('vault.pickFolder', {})) as { path: string | null }
    if (path) addPath(path)
  } catch {
    say(t('pick_failed'))
  } finally {
    pickButton.classList.remove('busy')
    pickButton.disabled = false
  }
})

// 노트 보기 (읽기 전용). 내용은 worker 가 읽고, 여기서는 텍스트 조각으로만 그린다.
const viewer = document.getElementById('viewer') as HTMLElement
const viewerTitle = document.getElementById('viewer-title') as HTMLSpanElement
const viewerBody = document.getElementById('viewer-body') as HTMLElement

let obsidianInstalled = false
const obsidianStatus = document.getElementById('obsidian-status') as HTMLParagraphElement

let viewingPath = ''
// 수정 버튼: 노트를 Orca 편집기 탭으로 연다
document.getElementById('viewer-edit')?.addEventListener('click', () => {
  orca.plugin.request('vault.editInObsidian', { root: viewingRoot, path: viewingPath }).catch((error: unknown) => {
    const code = (error as { code?: string }).code
    say(t(code === 'unavailable' ? 'edit_need_register' : 'edit_failed'))
  })
})
async function openNote(root: string, entry: Entry): Promise<void> {
  try {
    const { text } = (await orca.plugin.request('vault.read', { root, path: entry.path })) as { text: string }
    viewingRoot = root
    viewingPath = entry.path
    viewerTitle.textContent = entry.name
    viewerBody.replaceChildren(...renderBlocks(parseBlocks(text)))
    viewer.hidden = false
  } catch (error) {
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

// 위키링크를 누르면 같은 볼트에서 그 이름의 노트를 연다.
let viewingRoot = ''
async function openLink(name: string): Promise<void> {
  const { path } = (await orca.plugin.request('vault.findNote', { root: viewingRoot, name })) as { path: string | null }
  if (path) await openNote(viewingRoot, { name: `${name}.md`, path, dir: false })
  else say(t('link_not_found', { name }))
}

function renderInline(text: string): Node[] {
  return parseInline(text).map((part: Inline) => {
    if (part.kind === 'text') return document.createTextNode(part.text)
    const el = document.createElement(part.kind === 'strong' ? 'strong' : part.kind === 'em' ? 'em' : part.kind === 'code' ? 'code' : 'span')
    if (part.kind === 'wiki' || part.kind === 'tag') el.className = part.kind
    el.textContent = part.text
    if (part.kind === 'wiki') {
      // 별칭([[노트|표시]])과 제목([[노트#절]])을 떼고 노트 이름만 쓴다
      const name = part.text.split('|')[0].split('#')[0].trim()
      el.addEventListener('click', () => void openLink(name))
    }
    if (part.kind === 'tag') {
      // 태그를 누르면 SEARCH 에 그 태그를 넣고 찾는다
      el.addEventListener('click', (event) => {
        // SEARCH 탭을 펼쳐 보여 주고, MD 클릭으로 접히는 동작은 막는다
        event.stopPropagation()
        setCollapsed(false)
        showTab('search')
        searchInput.value = part.text
        void runSearch()
      })
    }
    return el
  })
}

// data-i18n 이 붙은 HTML 문구를 브라우저 언어로 바꾼다.
function applyLocale(): void {
  for (const el of document.querySelectorAll<HTMLElement>('[data-i18n]')) el.textContent = t(el.dataset.i18n as Key)
  for (const el of document.querySelectorAll<HTMLElement>('[data-i18n-title]')) el.title = t(el.dataset.i18nTitle as Key)
  for (const el of document.querySelectorAll<HTMLInputElement>('[data-i18n-placeholder]')) el.placeholder = t(el.dataset.i18nPlaceholder as Key)
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
  showTab('vaults')
  const lang = await orca.storage.get(LANG_KEY)
  if (typeof lang === 'string') setLang(lang)
  const { installed } = (await orca.plugin.request('obsidian.status', {})) as { installed: boolean }
  obsidianInstalled = installed
  obsidianStatus.hidden = false
  const saved = (await orca.storage.get(STATE_KEY)) as VaultState | null
  if (saved) state = saved
  refreshText()
})()
