# 게임 데이터와 이미지 출처

2026-11-03 확인. 버전 1.6의 출시된 캐릭터를 기준으로 기존 28명에 결, 티프로스, 리노, 사, 푸치나를 추가했습니다. 관리자 성별·프록시 ID는 별도 캐릭터로 중복 추가하지 않습니다.

## 캐릭터·육성 비용

- [rmxlinux/EndfieldData](https://github.com/rmxlinux/EndfieldData/tree/46b33765fd0c9997a61342c079b0ec98aabe3931), 커밋 `46b33765fd0c9997a61342c079b0ec98aabe3931`.
- 저장소에 명시된 데이터 갱신일: 2026-10-27, 지원 버전: 1.6.
- `CharGrowthTable`, `CharacterTable`: ID, 속성, 직업, 무기, 정예화·스킬·재능·능력치·기반시설 비용.
- `I18nTextTable_KR`, `ItemTable`, `SystemJumpTable`: 한국어 이름과 재료 획득처. 텍스트 키는 64비트 정수 정밀도를 보존하여 조회했습니다.
- `CharLevelUpTable`: 기존 89개 레벨 구간의 비용과 일치함을 확인했습니다.
- 신규 캐릭터별 44개 스킬 강화 행 및 정예화 비용이 공통 계산 템플릿과 일치합니다. 노드 비용은 각 캐릭터의 실제 테이블에서 추출했습니다.

`GachaCharPoolTable` 및 `TimeRangeTable`의 공개 시작일:

| 캐릭터 | ID | 공개 시작일 |
| --- | --- | --- |
| 결 / Arcane | `chr_0032_lizhiyan` | 2026-07-16 (1.4) |
| 티프로스 / Typhoeus | `chr_0034_typhoea` | 2026-09-02 (1.5) |
| 리노 / Liino | `chr_0035_liino` | 2026-08-09 (1.4) |
| 사 / Si | `chr_0036_jsspsi` | 2026-10-15 (1.6) |
| 푸치나 / Purrchena | `chr_0038_purrche` | 2026-09-02 (1.5 배포 이벤트) |

신규 재료는 도약 교질 도말 표본, 탈로스 버섯, 붉은 창 잎입니다. `DungeonTable`에서 도약 교질 도말 표본의 획득처인 **고위험 재료 용해조 / 위험한 재앙 · 사**를 확인했습니다. `RewardTable`의 수량이 서버 결정 값(0)이므로 신규 보스의 실제 회당 드롭 수량은 확정하지 않았습니다. 앱은 해당 재료의 필요·부족 수량을 계산하지만, 보상량 확인 전에는 보스 주행·이성 합계에서 제외합니다. 기존 보스의 기존 추정치는 유지했습니다.

## 이미지

- 초상화 32개: [Enka.Network](https://enka.network/), `https://enka.network/ui/ef/charroundicon/icon_round_<캐릭터 ID>.png`에서 2026-11-03 다운로드. `assets/operators/`에 포함했습니다.
- 관리자 공용 초상화: 기존 버전이 사용하던 [Prydwen의 남녀 관리자 이미지](https://cdn.prydwen.gg/images/arknights-endfield/characters/endministrator_icon.webp)를 원본 그대로 `assets/operators/endministrator.webp`에 포함했습니다. 남녀 관리자는 기존 공용 ID와 육성 기록을 사용합니다.
- 재료 아이콘 29개: [555me/EndfieldAssets](https://github.com/555me/EndfieldAssets/tree/966ed92d2556386a37e4ec076a812ff46ca2fae9), 커밋 `966ed92d2556386a37e4ec076a812ff46ca2fae9`, Android CN 1.6 / `initial_11262943-8_main_11262943-8`.
- 원본 경로: `assets/beyond/dynamicassets/gameplay/ui/sprites/itemicon/<ItemTable.iconId>.png`. 앱에는 `assets/items/<아이템 ID>.png`로 저장했습니다.
- 게임 데이터와 이미지의 권리는 Hypergryph 및 해당 권리자에게 있습니다. 이 저장소가 게임 이미지의 저작권을 소유한다고 주장하지 않습니다.

## 검증

`tests/fixtures/v1.6-costs.json`은 원본 `CharGrowthTable`의 노드·4개 스킬 그룹과 `CharLevelUpTable`을 합산한 준종결/종결 비용입니다. 앱의 `needOf()` 출력에서 생성하지 않았습니다.

Python 3, Node.js, Playwright, Chromium이 설치된 환경에서 다음을 실행합니다:

```sh
node tests/planner.cjs
```

Chromium 실행 파일이 다른 위치에 있으면 `CHROMIUM_PATH`를 지정합니다. 테스트는 자체 임시 포트에서 서버를 시작하고 종료하며, 별도 브라우저 컨텍스트를 사용합니다. 10개 비용 사례, 로컬 이미지 62개, 관리자 공용 초상화, 한글 조합·검색·필터, 상세 패널 키보드 조작, 이전 저장 데이터 유지, 재료 정산·파밍, 진행률 경계값 9개, 현재 프리셋 입력·되돌리기, 테마 저장, 320/390/1440px 화면과 두 HTML 진입점을 검증합니다.

로컬 실행:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

두 HTML 파일은 동일한 내용을 유지합니다. 배포하거나 파일을 옮길 때 `assets/` 폴더도 함께 포함해야 합니다.
