// Obsidian 열기 주소 규칙. 입출력이 없어서 node --test 로 검증한다.
// Obsidian 은 path= 에 볼트 폴더만 받는다. 노트는 볼트 이름 + 볼트 안 상대 경로(file=)로 연다.

export function noteUrl(vaultRoot: string, notePath: string): string {
  const root = vaultRoot.replace(/[\\/]+$/, '')
  const name = root.split(/[\\/]/).pop() ?? ''
  const rel = notePath
    .slice(root.length + 1)
    .replace(/\\/g, '/')
    .replace(/\.md$/i, '')
  return `obsidian://open?vault=${encodeURIComponent(name)}&file=${encodeURIComponent(rel)}`
}
