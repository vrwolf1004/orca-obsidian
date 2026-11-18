// 코드 블록 색칠. 언어 이름(```java 등)에 맞는 키워드 목록과 주석 표기를 쓴다.
// shortcut: 문법 전체가 아니라 흔한 키워드·주석·문자열·숫자·함수 호출·타입 이름만 색칠한다. 복잡한 문법(JSX 태그, 제네릭 등)은 정확하지 않다.

export type Token = {
  kind: 'plain' | 'comment' | 'string' | 'key' | 'number' | 'keyword' | 'constant' | 'func' | 'type'
  text: string
}

const CONSTANTS = ['true', 'false', 'null', 'undefined']

const JS = ['const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue',
  'try', 'catch', 'finally', 'throw', 'import', 'export', 'from', 'default', 'class', 'extends', 'new', 'this', 'super',
  'async', 'await', 'typeof', 'instanceof', 'null', 'undefined', 'true', 'false', 'useState', 'useEffect', 'useRef', 'useMemo', 'useCallback']
const JAVA = ['public', 'private', 'protected', 'static', 'final', 'abstract', 'void', 'int', 'long', 'double', 'float', 'boolean',
  'char', 'byte', 'short', 'class', 'interface', 'enum', 'extends', 'implements', 'new', 'this', 'super', 'return', 'if', 'else',
  'for', 'while', 'do', 'switch', 'case', 'break', 'continue', 'try', 'catch', 'finally', 'throw', 'throws', 'import', 'package',
  'instanceof', 'null', 'true', 'false', 'String']
const SQL = ['select', 'from', 'where', 'insert', 'into', 'values', 'update', 'set', 'delete', 'create', 'table', 'drop', 'alter',
  'join', 'left', 'right', 'inner', 'outer', 'on', 'and', 'or', 'not', 'null', 'is', 'in', 'like', 'order', 'by', 'group',
  'having', 'limit', 'as', 'distinct', 'union', 'primary', 'key', 'foreign', 'references', 'index', 'count', 'sum', 'avg',
  'min', 'max', 'case', 'when', 'then', 'else', 'end', 'between', 'exists']
const GENERIC = ['const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'import', 'from', 'class', 'def', 'true', 'false', 'null']

// 언어 이름 → 규칙. 모르는 언어(json 포함)는 일반 규칙을 쓴다.
const RULES: Record<string, { words: string[]; ci?: boolean; comment: string }> = {
  js: { words: JS, comment: '//[^\\n]*' },
  java: { words: JAVA, comment: '//[^\\n]*' },
  sql: { words: SQL, ci: true, comment: '--[^\\n]*' },
}
const ALIAS: Record<string, string> = { javascript: 'js', jsx: 'js', ts: 'js', typescript: 'js', tsx: 'js', react: 'js' }
const GENERIC_RULE = { words: GENERIC, comment: '//[^\\n]*|#[^\\n]*' }

function patternFor(lang: string): RegExp {
  const rule = RULES[ALIAS[lang] ?? lang] ?? GENERIC_RULE
  const words = rule.words.join('|')
  // 대소문자 무관 규칙(SQL)에서는 대문자 시작 단어를 타입으로 보지 않는다
  const type = rule.ci ? '(?!)' : '\\b(?<t>[A-Z][A-Za-z0-9_]*)\\b'
  const str = `"(?:\\\\.|[^"\\\\\\n])*"|'(?:\\\\.|[^'\\\\\\n])*'`
  return new RegExp(
    `(?<c>${rule.comment})|(?<s>${str})(?<k>\\s*:)?|\\b(?<n>\\d+(?:\\.\\d+)?)\\b|\\b(?<w>${words})\\b|(?<f>[A-Za-z_]\\w*)(?=\\s*\\()|${type}`,
    rule.ci ? 'gi' : 'g',
  )
}

export function highlight(code: string, lang = ''): Token[] {
  const out: Token[] = []
  let last = 0
  const plain = (text: string) => {
    if (text) out.push({ kind: 'plain', text })
  }
  for (const m of code.matchAll(patternFor(lang.toLowerCase()))) {
    const at = m.index ?? 0
    const g = m.groups ?? {}
    plain(code.slice(last, at))
    if (g.c !== undefined) out.push({ kind: 'comment', text: m[0] })
    else if (g.s !== undefined) {
      // 문자열 뒤에 ':' 가 오면 키 (JSON 등)
      out.push({ kind: g.k ? 'key' : 'string', text: g.s })
      plain(g.k ?? '')
    } else if (g.n !== undefined) out.push({ kind: 'number', text: g.n })
    else if (g.w !== undefined) out.push({ kind: CONSTANTS.includes(g.w) ? 'constant' : 'keyword', text: g.w })
    else if (g.f !== undefined) out.push({ kind: 'func', text: g.f })
    else out.push({ kind: 'type', text: g.t ?? '' })
    last = at + m[0].length
  }
  plain(code.slice(last))
  // 붙어 있는 평범한 글자는 한 덩어리로 합친다
  return out.reduce((merged: Token[], t) => {
    const prev = merged[merged.length - 1]
    if (prev?.kind === 'plain' && t.kind === 'plain') prev.text += t.text
    else merged.push({ ...t })
    return merged
  }, [])
}
