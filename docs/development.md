# 개발 절차

Orca CLI 경로 (Windows 기본 설치):

```text
ORCA="$LOCALAPPDATA\Programs\orca\resources\bin\orca.exe"
```

## 구조

```text
orca-plugin.json     매니페스트 (trusted-worker, 패널 obsidian, main: src/worker.ts)
panel/               패널 화면 (index.html, style.css). 빌드 없이 src/panel.ts 를 직접 읽는다
src/worker.ts        워커: 볼트 목록 읽기, 새 폴더·노트 만들기, 노트 읽기, Obsidian 설치 확인
src/panel.ts         패널 로직: 볼트 목록, 노트 트리, 노트 보기, 우클릭 메뉴, 단축키
src/markdown.ts      Markdown 파서 (텍스트 조각만 만든다, HTML 로 해석하지 않는다)
src/highlight.ts     코드 색칠 (언어별 키워드 목록)
src/tree.ts          폴더 목록 거르기·정렬, 볼트 밖 경로 검사
src/names.ts         새 이름 검사, .md 붙이기
src/vaults.ts        볼트 목록 규칙
src/i18n.ts          7개 언어 문구, 언어 선택
tests/               node --test 단위 테스트
docs/                이 문서, todo, 릴리스 노트, 스토어 이미지
```

## 권한

- `execution`: `trusted-worker`. 워커는 사용자 계정 권한의 Node.js 프로세스로 실행된다.
- `capabilities`: `storage:own` (볼트 목록과 언어 저장).
- 워커가 하는 일은 README 의 권한 절과 같다: 볼트 읽기, 사용자가 확인한 새 폴더·노트 만들기, Obsidian 설치 확인.

## 1. 단위 테스트

```text
node --test tests/vaults.test.ts tests/tree.test.ts tests/names.test.ts tests/markdown.test.ts tests/table.test.ts tests/highlight.test.ts tests/i18n.test.ts
```

새 파서나 규칙을 바꾸면 해당 테스트를 먼저 고친다.

## 2. 매니페스트 검증과 권한 확인

```text
"$ORCA" plugin validate .
"$ORCA" plugin inspect .
```

`inspect` 는 권한과 콘텐츠 해시, 패키지 크기를 보여 준다. 파일을 바꾸면 해시가 바뀌고, 그때 승인을 다시 받는다.

## 3. 개발 폴더 로드

```text
"$ORCA" plugin dev load .
```

처음 로드하면 승인 지문(`ap1-...`)이 나온다. 사용자가 확인한 뒤 `--approve <지문>` 을 붙여 다시 실행한다. 승인은 파일 내용과 권한에 묶인다. 권한이 늘면(예: 새 capability) 다시 승인해야 한다.

코드만 고친 경우에는 다음으로 다시 불러온다:

```text
"$ORCA" plugin dev reload
```

## 4. 패널 열기와 캡처

```text
"$ORCA" plugin open local.obsidian-for-orca --panel obsidian
"$ORCA" plugin shot local.obsidian-for-orca --panel obsidian --out <png 경로>
```

- `plugin open` 으로 패널을 먼저 연 뒤 찍는다. 열지 않으면 빈 화면이 나올 수 있다.
- HTML 패널은 `--act` 로 클릭할 수 없다. 클릭이 필요한 확인은 사람이 직접 한다.

## 5. 로그와 워커 호출

```text
"$ORCA" plugin logs local.obsidian-for-orca
"$ORCA" plugin dev request local.obsidian-for-orca obsidian.status
```

재로드 직후에는 이전 빌드의 오류가 로그에 남을 수 있다. 시각을 보고 최신 오류인지 확인한다.

## 6. 헤드리스 확인

Orca 밖에서 패널을 확인하려면 Chrome 으로 `panel/index.html` 을 열고, 워커 응답을 흉내 낸 가짜 `window.orca` 를 넣는다. 빌드는 esbuild 로 `src/panel.ts` 를 IIFE 로 묶는다. 이 방식은 DOM 동작만 확인하고, Orca 에서의 동작을 대신하지 않는다.

## 7. 스토어 이미지

`docs/store/` 의 이미지는 샘플 볼트(`D:/Notes/Work`)를 헤드리스 Chrome 으로 그린 것이다. 실제 사용자 경로나 이름을 넣지 않는다. 다시 찍을 때는 Orca 실제 화면으로 찍는 것을 권장한다.

## 8. 개발 폴더 제거

```text
"$ORCA" plugin dev unload .
```

## 확인 상태

| 항목 | 상태 |
| --- | --- |
| 단위 테스트 (7개 파일) | 통과 (0.5.0) |
| 매니페스트 검증 (`plugin validate`) | 통과 (0.5.0) |
| 권한 확인 (`plugin inspect`) | trusted-worker, storage:own |
| 개발 폴더 로드 (`plugin dev load`) | 통과 (승인 후 `running`) |
| 패널 열기 (`plugin open`) | 통과 |
| 헤드리스 패널 동작 | 통과 (볼트, 노트 보기, 우클릭 생성, Ctrl+H, F2) |
| Orca 안에서 클릭 동작 | 미확인 (`docs/todo.md` 의 실제 Orca 확인 목록) |
