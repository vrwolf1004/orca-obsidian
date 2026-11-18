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
