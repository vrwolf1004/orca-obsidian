import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// 언어 파일 전체를 읽어서 키 집합과 {자리표시자}를 비교한다 (언어 전환 함수는 쓰지 않는다).
const source = readFileSync(new URL('../src/i18n.ts', import.meta.url), 'utf8')
const blocks = [...source.matchAll(/const (\w+): typeof ko = \{([\s\S]*?)\n\}/g)]
const koBlock = /const ko = \{([\s\S]*?)\n\}/.exec(source)?.[1] ?? ''

function keysOf(block: string): string[] {
  return [...block.matchAll(/^\s+(\w+):/gm)].map((m) => m[1]).sort()
}

test('모든 언어가 같은 키를 가진다', () => {
  const expected = keysOf(koBlock)
  assert.ok(expected.length > 30)
  assert.equal(blocks.length, 6)
  for (const [, lang, body] of blocks) assert.deepEqual(keysOf(body), expected, lang)
})

test('자리표시자 {name} 은 언어마다 같다', () => {
  const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',')
  const koLines = [...koBlock.matchAll(/^\s+(\w+): '([^']*)'/gm)]
  for (const [, lang, body] of blocks) {
    for (const [, key, text] of koLines) {
      const other = new RegExp(`^\\s+${key}: '([^']*)'`, 'm').exec(body)?.[1] ?? ''
      assert.equal(placeholders(other), placeholders(text), `${lang}.${key}`)
    }
  }
})
