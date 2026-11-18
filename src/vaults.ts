// 볼트 목록 규칙. 입출력이 없어서 node --test 로 바로 검증한다.

export type Vault = { name: string; path: string }
export type VaultState = { vaults: Vault[]; current: string | null }
export type VaultResult = { ok: true; state: VaultState } | { ok: false; reason: 'empty' | 'duplicate' }

export const emptyState: VaultState = { vaults: [], current: null }

// 폴더 이름만 표시한다 (경로 구분자는 / 와 \ 둘 다 본다).
export function vaultName(path: string): string {
  const parts = path.replace(/[\\/]+$/, '').split(/[\\/]/)
  return parts[parts.length - 1] || path
}

export function addVault(state: VaultState, rawPath: string): VaultResult {
  const path = rawPath.trim()
  if (!path) return { ok: false, reason: 'empty' }
  if (state.vaults.some((v) => v.path === path)) return { ok: false, reason: 'duplicate' }
  const vaults = [...state.vaults, { name: vaultName(path), path }]
  // 첫 볼트는 바로 현재 볼트로 쓴다.
  return { ok: true, state: { vaults, current: state.current ?? path } }
}

export function removeVault(state: VaultState, path: string): VaultState {
  const vaults = state.vaults.filter((v) => v.path !== path)
  const current = state.current === path ? (vaults[0]?.path ?? null) : state.current
  return { vaults, current }
}

export function selectVault(state: VaultState, path: string): VaultState {
  if (!state.vaults.some((v) => v.path === path)) return state
  return { ...state, current: path }
}

