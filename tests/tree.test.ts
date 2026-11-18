import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isInside, keepEntry, sortEntries, toEntries } from '../src/tree.ts'

test('숨김 항목은 빼고, 파일은 .md 만 남긴다', () => {
  assert.equal(keepEntry({ name: '.obsidian', isDir: true }), false)
  assert.equal(keepEntry({ name: 'image.png', isDir: false }), false)
  assert.equal(keepEntry({ name: 'Plan.MD', isDir: false }), true)
  assert.equal(keepEntry({ name: 'Archive', isDir: true }), true)
})

test('폴더가 먼저, 이름은 대소문자 무시로 정렬한다', () => {
  const sorted = sortEntries([
    { name: 'b.md', path: '', dir: false },
    { name: 'Zeta', path: '', dir: true },
    { name: 'a.md', path: '', dir: false },
    { name: 'alpha', path: '', dir: true },
  ])
  assert.deepEqual(sorted.map((e) => e.name), ['alpha', 'Zeta', 'a.md', 'b.md'])
})

test('볼트 밖 경로는 거절한다', () => {
  assert.equal(isInside('/v/root', '/v/root'), true)
  assert.equal(isInside('/v/root', '/v/root/sub/x'), true)
  assert.equal(isInside('/v/root', '/v/root/../other'), false)
  assert.equal(isInside('/v/root', '/v/rootx'), false)
})

test('toEntries 는 거르고 정렬한 뒤 경로를 붙인다', () => {
  const out = toEntries('/v', [{ name: 'n.md', isDir: false }, { name: '.trash', isDir: true }, { name: 'd', isDir: true }], (a, b) => `${a}/${b}`)
  assert.deepEqual(out, [{ name: 'd', path: '/v/d', dir: true }, { name: 'n.md', path: '/v/n.md', dir: false }])
})
