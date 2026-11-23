import { test } from 'node:test'
import assert from 'node:assert/strict'
import { noteUrl } from '../src/obsidian.ts'

test('노트 주소는 볼트 이름과 볼트 안 상대 경로(.md 제외)로 만든다', () => {
  const root = String.raw`C:\work\obsidian\test`
  assert.equal(noteUrl(root, String.raw`C:\work\obsidian\test\Projects\plan.md`), 'obsidian://open?vault=test&file=Projects%2Fplan')
  assert.equal(noteUrl(root + '\\', String.raw`C:\work\obsidian\test\welcome.md`), 'obsidian://open?vault=test&file=welcome')
})
