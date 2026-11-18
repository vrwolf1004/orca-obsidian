// 폴더 트리 규칙. 파일 시스템 접근은 worker 가 하고, 여기서는 거르기와 정렬, 경로 검사만 한다.
import { isAbsolute, relative, resolve } from 'node:path'

export type Entry = { name: string; path: string; dir: boolean }
export type RawEntry = { name: string; isDir: boolean }

// 숨김 항목(.obsidian, .trash 등)은 빼고, 파일은 노트(.md)만 보인다.
export function keepEntry(entry: RawEntry): boolean {
  if (entry.name.startsWith('.')) return false
  return entry.isDir || entry.name.toLowerCase().endsWith('.md')
}

// 폴더 먼저, 이름은 대소문자 무시.
export function sortEntries(entries: Entry[]): Entry[] {
  return [...entries].sort((a, b) => {
    if (a.dir !== b.dir) return a.dir ? -1 : 1
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  })
}

// dir 이 root 안에 있는지 확인한다 (상위 폴더로 나가는 입력을 막는다).
export function isInside(root: string, dir: string): boolean {
  const rel = relative(resolve(root), resolve(dir))
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))
}

export function toEntries(dirAbs: string, raw: RawEntry[], join: (a: string, b: string) => string): Entry[] {
  return sortEntries(
    raw.filter(keepEntry).map((e) => ({ name: e.name, path: join(dirAbs, e.name), dir: e.isDir })),
  )
}
