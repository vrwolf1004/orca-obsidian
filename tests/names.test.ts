import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isValidName, noteFileName } from '../src/names.ts'

test('정상 이름은 통과하고, 숨김·금지 문자·예약 이름·끝의 점은 막는다', () => {
  assert.equal(isValidName('Plan'), true)
  assert.equal(isValidName('회의록 2026'), true)
  assert.equal(isValidName(''), false)
  assert.equal(isValidName('..'), false)
  assert.equal(isValidName('.hidden'), false)
  assert.equal(isValidName('a/b'), false)
  assert.equal(isValidName('a:b'), false)
  assert.equal(isValidName('name.'), false)
  assert.equal(isValidName('name '), true) // 앞뒤 공백은 먼저 잘라서 본다 ('name' 과 같다)
  assert.equal(isValidName('CON'), false)
  assert.equal(isValidName('nul.md'), false)
})

test('노트 이름에는 .md 를 기본으로 붙인다', () => {
  assert.equal(noteFileName('Plan'), 'Plan.md')
  assert.equal(noteFileName(' Plan '), 'Plan.md')
  assert.equal(noteFileName('Plan.md'), 'Plan.md')
  assert.equal(noteFileName('Plan.MD'), 'Plan.MD')
})
