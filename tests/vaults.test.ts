import { test } from 'node:test'
import assert from 'node:assert/strict'
import { addVault, emptyState, removeVault, selectVault, vaultName } from '../src/vaults.ts'

const WIN_PATH = String.raw`C:\vault\a`

test('vaultName 은 마지막 폴더 이름을 쓴다', () => {
  assert.equal(vaultName(String.raw`C:\work\obsidian\herdr_test`), 'herdr_test')
  assert.equal(vaultName('/home/me/notes/'), 'notes')
})

test('첫 볼트는 현재 볼트가 되고, 빈 경로와 중복은 거절한다', () => {
  const a = addVault(emptyState, `  ${WIN_PATH}  `)
  assert.ok(a.ok)
  assert.deepEqual(a.state, { vaults: [{ name: 'a', path: WIN_PATH }], current: WIN_PATH })
  assert.deepEqual(addVault(emptyState, '   '), { ok: false, reason: 'empty' })
  assert.deepEqual(addVault(a.state, WIN_PATH), { ok: false, reason: 'duplicate' })
})

test('두 번째 볼트는 현재 볼트를 바꾸지 않고, select 로 바꾼다', () => {
  const a = addVault(emptyState, '/v/a')
  if (!a.ok) throw new Error('setup')
  const b = addVault(a.state, '/v/b')
  if (!b.ok) throw new Error('setup')
  assert.equal(b.state.current, '/v/a')
  assert.equal(selectVault(b.state, '/v/b').current, '/v/b')
  assert.equal(selectVault(b.state, '/nope').current, '/v/a')
})

test('현재 볼트를 지우면 남은 첫 볼트로 넘어가고, 모두 지우면 null', () => {
  const a = addVault(emptyState, '/v/a')
  if (!a.ok) throw new Error('setup')
  const b = addVault(a.state, '/v/b')
  if (!b.ok) throw new Error('setup')
  assert.equal(removeVault(b.state, '/v/a').current, '/v/b')
  assert.equal(removeVault(removeVault(b.state, '/v/a'), '/v/b').current, null)
})

