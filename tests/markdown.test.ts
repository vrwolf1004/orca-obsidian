import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseBlocks, parseInline } from '../src/markdown.ts'

test('제목, 문단(줄바꿈 유지), 목록을 나눈다', () => {
  const blocks = parseBlocks('# Title\n\nfirst line\nsecond line\n\n- a\n- b\n')
  assert.deepEqual(blocks, [
    { kind: 'heading', level: 1, text: 'Title' },
    { kind: 'paragraph', text: 'first line\nsecond line' },
    { kind: 'list', items: [{ text: 'a', checked: null }, { text: 'b', checked: null }] },
  ])
})

test('체크박스와 번호 목록을 항목 상태로 나눈다', () => {
  const blocks = parseBlocks('- [ ] todo\n- [x] done\n1. first\n2. second')
  assert.deepEqual(blocks, [{ kind: 'list', items: [{ text: 'todo', checked: false }, { text: 'done', checked: true }, { text: 'first', checked: null }, { text: 'second', checked: null }] }])
})

test('코드 블록 안의 기호는 그대로 둔다', () => {
  const blocks = parseBlocks('```\n# not a heading\n- not a list\n```')
  assert.deepEqual(blocks, [{ kind: 'code', lang: '', text: '# not a heading\n- not a list' }])
})

test('맨 앞 YAML 머리말은 건너뛴다', () => {
  const blocks = parseBlocks('---\ntags: x\n---\n# Real')
  assert.deepEqual(blocks, [{ kind: 'heading', level: 1, text: 'Real' }])
})

test('인라인: 굵게, 기울임, 코드, 위키링크', () => {
  assert.deepEqual(parseInline('a **b** *c* `d` [[Note]] e'), [
    { kind: 'text', text: 'a ' },
    { kind: 'strong', text: 'b' },
    { kind: 'text', text: ' ' },
    { kind: 'em', text: 'c' },
    { kind: 'text', text: ' ' },
    { kind: 'code', text: 'd' },
    { kind: 'text', text: ' ' },
    { kind: 'wiki', text: 'Note' },
    { kind: 'text', text: ' e' },
  ])
})

test('HTML 조각은 텍스트로 남는다', () => {
  assert.deepEqual(parseInline('<img src=x onerror=alert(1)>'), [{ kind: 'text', text: '<img src=x onerror=alert(1)>' }])
})

test('#태그는 태그로, 문장 중간의 # 과 제목은 태그가 아니다', () => {
  assert.deepEqual(parseInline('환기 #wise #현대알루미늄'), [
    { kind: 'text', text: '환기 ' },
    { kind: 'tag', text: '#wise' },
    { kind: 'text', text: ' ' },
    { kind: 'tag', text: '#현대알루미늄' },
  ])
  assert.deepEqual(parseInline('C#은 언어'), [{ kind: 'text', text: 'C#은 언어' }])
  assert.deepEqual(parseBlocks('# 제목')[0], { kind: 'heading', level: 1, text: '제목' })
})
