# 개발 절차

```text
ORCA="$LOCALAPPDATA\Programs\orca\resources\bin\orca.exe"
```

## 1. 매니페스트 검증

```text
"$ORCA" plugin validate .
```

## 2. 권한 확인

```text
"$ORCA" plugin inspect .
```

요청하는 권한과 콘텐츠 해시를 보여 줍니다. 해시가 바뀌면 다시 승인해야 합니다.

## 3. 개발 폴더 로드

```text
"$ORCA" plugin dev load .
```

처음 로드하면 승인 지문(`ap1-...`)이 나옵니다. `--approve <지문>`을 붙여 다시 실행합니다. 파일을 바꾸면 지문이 바뀝니다.

## 4. 패널 캡처

```text
"$ORCA" plugin open local.obsidian-for-orca --panel obsidian
"$ORCA" plugin shot local.obsidian-for-orca --panel obsidian --out <png 경로>
```

- `plugin open`으로 패널을 먼저 연 뒤 찍습니다. 열지 않으면 빈 화면이 나올 수 있습니다.
- 배경과 글자색은 CSS에 직접 지정합니다. 지정하지 않으면 캡처가 흰 화면으로 나왔습니다 (0.1.0 확인 중 발견).

## 5. 로그

```text
"$ORCA" plugin logs local.obsidian-for-orca
```

## 6. 개발 폴더 제거

```text
"$ORCA" plugin dev unload .
```

## 확인 상태

| 항목 | 상태 |
| --- | --- |
| 매니페스트 검증 (`plugin validate`) | 통과 (0.1.0) |
| 권한 확인 (`plugin inspect`) | 통과, 권한 없음 |
| 개발 폴더 로드, 패널 캡처 | 미확인 |
