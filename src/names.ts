// 새 폴더·노트 이름 규칙. 입출력이 없어서 패널과 워커가 함께 쓴다 (node 모듈을 쓰지 않는다).

const FORBIDDEN = /[\\/:*?"<>|\x00-\x1f]/
const WINDOWS_RESERVED = /^(con|prn|aux|nul|com\d|lpt\d)(\.|$)/i

// 숨김 이름(.으로 시작), Windows 에서 안 되는 문자, 끝의 점·공백, 예약 이름을 막는다.
export function isValidName(name: string): boolean {
  const n = name.trim()
  if (!n || n === '.' || n === '..') return false
  if (n.startsWith('.') || /[. ]$/.test(n)) return false
  if (FORBIDDEN.test(n) || WINDOWS_RESERVED.test(n)) return false
  return true
}

// 노트는 기본으로 .md 를 붙인다. 이미 .md 로 끝나면 그대로 둔다.
export function noteFileName(name: string): string {
  const n = name.trim()
  return n.toLowerCase().endsWith('.md') ? n : `${n}.md`
}
