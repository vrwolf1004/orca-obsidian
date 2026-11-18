// 읽기 전용 Markdown 파서. 제목, 문단(줄바꿈 유지), 목록(번호·체크박스 포함), 코드 블록,
// 굵게, 기울임, 인라인 코드, [[위키링크]]를 다룬다. 외부 라이브러리를 쓰지 않는다.
// 결과는 텍스트 조각이라서 패널이 HTML 로 해석하지 않는다.

export type Inline = { kind: 'text' | 'strong' | 'em' | 'code' | 'wiki' | 'tag'; text: string }
export type Block =
  | { kind: 'heading'; level: number; text: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'list'; items: ListItem[] }
  | { kind: 'code'; lang: string; text: string }
  | { kind: 'table'; header: string[]; rows: string[][] }

// |---|:---:| 같은 구분선
const SEPARATOR = /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/

// "| a | b |" 한 줄을 칸 배열로
function cells(line: string): string[] {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim())
}
// checked: 체크박스 항목이면 true/false, 일반 항목이면 null
export type ListItem = { text: string; checked: boolean | null }

const INLINE = /\[\[([^\]]+)\]\]|\*\*([^*]+)\*\*|\*([^*\n]+)\*|`([^`]+)`|(?<=^|\s)#([\p{L}\p{N}_/-]+)/gu

export function parseInline(text: string): Inline[] {
  const out: Inline[] = []
  let last = 0
  for (const m of text.matchAll(INLINE)) {
    const at = m.index ?? 0
    if (at > last) out.push({ kind: 'text', text: text.slice(last, at) })
    if (m[1] !== undefined) out.push({ kind: 'wiki', text: m[1] })
    else if (m[2] !== undefined) out.push({ kind: 'strong', text: m[2] })
    else if (m[3] !== undefined) out.push({ kind: 'em', text: m[3] })
    else if (m[5] !== undefined) out.push({ kind: 'tag', text: `#${m[5]}` })
    else out.push({ kind: 'code', text: m[4] ?? '' })
    last = at + m[0].length
  }
  if (last < text.length) out.push({ kind: 'text', text: text.slice(last) })
  return out
}

// [ ] 와 [x] 는 체크 상태로 뽑는다.
function listItem(text: string): ListItem {
  if (/^\[ \]\s/.test(text)) return { text: text.slice(4), checked: false }
  if (/^\[[xX]\]\s/.test(text)) return { text: text.slice(4), checked: true }
  return { text, checked: null }
}

export function parseBlocks(source: string): Block[] {
  let lines = source.replace(/\r\n/g, '\n').split('\n')
  // 맨 앞의 YAML 머리말(---)은 본문이 아니므로 건너뛴다.
  if (lines[0] === '---') {
    const end = lines.indexOf('---', 1)
    if (end > 0) lines = lines.slice(end + 1)
  }

  const blocks: Block[] = []
  let para: string[] = []
  let list: ListItem[] | null = null
  let code: string[] | null = null
  let lang = ''

  const flush = () => {
    // 문단은 줄바꿈을 살린다 (Obsidian 처럼 줄마다 줄바꿈)
    if (para.length) blocks.push({ kind: 'paragraph', text: para.join('\n') })
    if (list) blocks.push({ kind: 'list', items: list })
    para = []
    list = null
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (code) {
      if (line.startsWith('```')) {
        blocks.push({ kind: 'code', lang, text: code.join('\n') })
        code = null
      } else {
        code.push(line)
      }
      continue
    }
    if (line.startsWith('```')) {
      flush()
      code = []
      lang = line.slice(3).trim().toLowerCase()
      continue
    }
    // 표: 머리줄 다음에 |---| 구분선이 오면 그 아래 | 로 된 줄을 모두 행으로 본다
    if (line.includes('|') && SEPARATOR.test(lines[i + 1] ?? '')) {
      flush()
      const rows = [cells(line)]
      for (i += 2; i < lines.length && lines[i].includes('|') && lines[i].trim() !== ''; i++) rows.push(cells(lines[i]))
      i--
      blocks.push({ kind: 'table', header: rows[0], rows: rows.slice(1) })
      continue
    }
    const heading = /^(#{1,6})\s+(.*)$/.exec(line)
    const item = /^\s*(?:[-*]|\d+\.)\s+(.*)$/.exec(line)
    if (heading) {
      flush()
      blocks.push({ kind: 'heading', level: heading[1].length, text: heading[2] })
    } else if (item) {
      if (para.length) flush()
      list = list ?? []
      list.push(listItem(item[1]))
    } else if (line.trim() === '') {
      flush()
    } else {
      if (list) flush()
      para.push(line.trim())
    }
  }
  if (code) blocks.push({ kind: 'code', lang, text: code.join('\n') })
  flush()
  return blocks
}
