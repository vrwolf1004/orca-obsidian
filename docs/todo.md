# TODO

상태 표기: `[ ]` 할 일, `[x]` 완료.

## 기본 골격

- [x] 매니페스트 `orca-plugin.json` (id `obsidian-for-orca`, 표시 이름 `Obsidian for Orca`)
- [x] 패널 자리표시자 (`panel/index.html`)
- [x] MIT 라이선스, `.gitignore`
- [x] `orca plugin validate` 통과
- [x] 볼트 등록과 목록 선택: 경로 입력, 추가, 선택, 삭제 (`src/vaults.ts`, 상태는 storage:own 에 저장)
- [ ] 볼트 폴더 존재 확인 (샌드박스 패널은 파일을 못 보므로 worker 필요)
- [ ] 패널에서 추가 버튼 클릭 흐름을 Orca 안에서 직접 확인
- [ ] 볼트 폴더 트리 표시 (herdr-obsidian 0.5.0 기능 참고)
- [ ] Markdown 읽기 표시
- [ ] 편집과 자동 저장 (herdr-obsidian 과 같은 방식: 임시 파일 후 이름 바꾸기, 외부 변경 감지)
- [ ] 필요한 capability 확정 후 `capabilities` 에 추가하고 README 권한 절 갱신

## 다국어

- [ ] 패널 문구 언어 정하기 (herdr-obsidian 처럼 en, ko, ru, fr, es, de, ja 를 목표로 할지 결정)

## 테스트

- [x] 단위 테스트 `node --test tests/vaults.test.ts` (4개 통과)
- [ ] 샘플 볼트 준비
- [ ] 로직 단위 테스트 (트리 구성, 읽기·쓰기)
- [ ] Orca 안에서 패널 동작 확인 (`plugin dev load` 후 사람이 직접)

## 배포 (orca-radio, orca-tetris 에서 얻은 교훈)

- [ ] 저장소 공개 생성 (`vrwolf1004/orca-obsidian`), 토픽 `orca-plugin` (사용자 확인 후 진행)
- [ ] 아이콘 512×512 (`docs/store/icon.png`, 256KB 이하)
- [ ] 대표 이미지 1600×1000 WebP (`docs/store/cover.webp`, 1024KB 이하)
- [ ] 스크린샷 2560×1600 WebP, 최소 1280×800 (`docs/store/`), 1536KB 이하
- [ ] `plugin inspect` 로 파일 수와 용량 확인 (기준: 1MB 이하)
- [ ] README 영문·한글 최종 점검, 권한 설명 포함
- [ ] 태그 `v0.1.0` 푸시 (목록 반영까지 최대 1시간)
- [ ] 상태 페이지에서 검토 상태 확인 (`Under review` 이면 검토 중)
- [ ] 수동 설치 주소 `https://github.com/vrwolf1004/orca-obsidian#v0.1.0` 으로 설치 확인

## 개선 제안

- [ ] 노트 보기 위치: 노트가 길면 보기 영역이 목록 아래에 있어 찾기 어렵다. 목록 위에 두거나 펼친 노트가 항상 보이게 한다
- [ ] 위키링크 누르기: 같은 볼트의 노트를 열도록 한다 (지금은 강조만 한다)
- [ ] 태그 누르기: 그 태그가 붙은 노트를 찾는다
- [ ] 검색: 볼트 안의 노트 이름과 본문을 찾는다
- [ ] 큰 볼트 성능: 폴더를 누를 때마다 목록 전체를 다시 그린다. 펼친 폴더만 갱신하도록 바꾼다
- [ ] Obsidian 설치 확인: 기본 설치 위치 외에 설치된 경우를 찾는다 (설정으로 경로 지정)
- [ ] 마크다운: 이미지, `[글자](주소)` 링크, 번호 목록 순서 표시를 지원한다
- [ ] 코드 색칠: 언어별 키워드를 더 맞추고, JSX 태그와 Java 제네릭을 다룬다
- [ ] 체크박스: 테마에 맞춘 색을 확인한다
- [ ] 권한: `trusted-worker`는 사용자 계정 권한으로 실행된다. 샌드박스로 할 수 있는 범위를 다시 검토한다
- [ ] 실제 Orca 확인 목록: 볼트 추가, 노트 열기, 우클릭 생성, 표·체크박스·태그 보기, Ctrl+H, F2 언어 변경을 Orca 안에서 한 번씩 눌러 확인한다
- [ ] 스토어 스크린샷: 헤드리스 Chrome 대신 Orca 실제 화면으로 다시 찍는다
- [ ] 번역 검수: 일본어, 독일어, 스페인어, 프랑스어, 러시아어를 원어민이 확인한다
