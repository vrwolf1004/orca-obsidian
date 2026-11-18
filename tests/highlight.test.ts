import { test } from 'node:test'
import assert from 'node:assert/strict'
import { highlight } from '../src/highlight.ts'

test('JSON: 키, 문자열, 숫자, 상수를 나눈다', () => {
  assert.deepEqual(highlight('{ "test": "test", "n": 1, "ok": true }'), [
    { kind: 'plain', text: '{ ' },
    { kind: 'key', text: '"test"' },
    { kind: 'plain', text: ': ' },
    { kind: 'string', text: '"test"' },
    { kind: 'plain', text: ', ' },
    { kind: 'key', text: '"n"' },
    { kind: 'plain', text: ': ' },
    { kind: 'number', text: '1' },
    { kind: 'plain', text: ', ' },
    { kind: 'key', text: '"ok"' },
    { kind: 'plain', text: ': ' },
    { kind: 'constant', text: 'true' },
    { kind: 'plain', text: ' }' },
  ])
})

test('주석과 키워드를 찾는다', () => {
  assert.deepEqual(highlight('const a = 1 // note'), [
    { kind: 'keyword', text: 'const' },
    { kind: 'plain', text: ' a = ' },
    { kind: 'number', text: '1' },
    { kind: 'plain', text: ' ' },
    { kind: 'comment', text: '// note' },
  ])
})

test('특별한 문법이 없으면 전부 평범한 글자', () => {
  assert.deepEqual(highlight('hello world'), [{ kind: 'plain', text: 'hello world' }])
})

test('SQL: 대소문자 무관 키워드와 -- 주석, 대문자 단어는 타입으로 보지 않는다', () => {
  assert.deepEqual(highlight('SELECT a FROM Users -- note', 'sql'), [
    { kind: 'keyword', text: 'SELECT' },
    { kind: 'plain', text: ' a ' },
    { kind: 'keyword', text: 'FROM' },
    { kind: 'plain', text: ' Users ' },
    { kind: 'comment', text: '-- note' },
  ])
})

test('Java: 접근 제한자와 자료형 키워드, 함수 호출, 타입 이름', () => {
  const tokens = highlight('public static void main(String[] args) { System.out.println(x); }', 'java')
  assert.deepEqual(tokens.filter((t) => t.kind === 'keyword').map((t) => t.text), ['public', 'static', 'void', 'String'])
  assert.ok(tokens.some((t) => t.kind === 'func' && t.text === 'println'))
  assert.ok(tokens.some((t) => t.kind === 'type' && t.text === 'System'))
})

test('React(jsx): JS 규칙을 쓰고 useState 를 키워드로 본다', () => {
  const tokens = highlight('const [n, setN] = useState(0)', 'jsx')
  assert.ok(tokens.some((t) => t.kind === 'keyword' && t.text === 'useState'))
})

test('함수 호출은 func 로 색칠하고, 키워드 if( 는 키워드로 남긴다', () => {
  assert.deepEqual(highlight('if (run(x))', 'js'), [
    { kind: 'keyword', text: 'if' },
    { kind: 'plain', text: ' (' },
    { kind: 'func', text: 'run' },
    { kind: 'plain', text: '(x))' },
  ])
})
