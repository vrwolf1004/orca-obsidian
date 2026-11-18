import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseBlocks } from '../src/markdown.ts'

test('머리줄, 구분선, 행으로 표를 만든다', () => {
  const blocks = parseBlocks('| 이름 | 값 |\n|---|:---:|\n| a | 1 |\n| b | 2 |\n\n다음 문단')
  assert.deepEqual(blocks, [
    { kind: 'table', header: ['이름', '값'], rows: [['a', '1'], ['b', '2']] },
    { kind: 'paragraph', text: '다음 문단' },
  ])
})

test('구분선이 없으면 표가 아니다', () => {
  assert.deepEqual(parseBlocks('a | b'), [{ kind: 'paragraph', text: 'a | b' }])
})
