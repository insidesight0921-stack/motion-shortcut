# 배포 검증 — 2026-09-21

검증 대상: 로컬 HEAD `2ecd272` + 커밋되지 않은 카메라 권한 수정 및 회귀 테스트, 운영 사이트 https://adamsmith.ai.kr.

## 판정

웹 프로덕션 빌드와 자동 테스트는 통과했다. 운영 사이트의 기본 화면과 지원 자산도 제공되고 있다. 다만 운영 번들에는 카메라 권한 수정이 아직 없고, 린트 오류 및 macOS Gatekeeper 거부가 있어 모든 배포 검증이 완료됐다고 판단할 수 없다.

## 실행 결과

| 검사 | 결과 |
| --- | --- |
| `npm test` | 9개 파일, 85개 테스트 통과 |
| `npm run test:electron` | 10개 테스트 통과 |
| `npm run lint` | 실패: `src/main.tsx:10`의 `react-refresh/only-export-components` |
| `npm run dist:mac` 내 네이티브 빌드 | arm64 helper 컴파일·서명 성공 |
| `npm run dist:mac` 내 웹 빌드 | TypeScript 및 Vite 프로덕션 빌드 성공 |
| macOS 패키징 | APP·ZIP·DMG 생성 성공. 초기 샌드박스 실행에서는 DMG 생성 실패; 제한 없는 환경에서 정식 패키징 재실행 성공 |
| 앱 서명 무결성 | `codesign --verify --deep --strict` 통과 |
| 외부 실행 신뢰 | ad-hoc 서명, TeamIdentifier 없음. `spctl --assess --type execute --verbose=2` 결과 `rejected` |
| 운영 화면 | Chrome에서 홈, 설정 모달, 가이드 표시 확인; 해당 흐름의 수집된 콘솔 경고·오류 없음 |
| 운영 자산 | JS/CSS, MediaPipe 모델·WASM, PDF 지원 자산 210개 HEAD 응답 HTTP 200 및 HTML 오응답 없음; PDF worker 1개 추가 HTTP 200 확인 |

## 발견 사항

1. **운영에 카메라 수정 미반영.** 운영 `assets/index-DVZ3-Lrc.js`는 권한 조회 후 `result.state`로 무조건 덮어쓰는 기존 로직이다. 로컬 빌드의 메인 번들은 `assets/index-CUx7uuzE.js`다. 번들 이름 차이뿐 아니라 실제 권한 처리 코드도 확인했다.
2. **린트 실패.** `main.tsx`에서 선언한 lazy 컴포넌트가 Fast Refresh 린트 규칙에 걸린다. 프로덕션 빌드는 통과하지만 품질 검사는 실패한다.
3. **macOS 일반 배포 신뢰 미충족.** 서명 무결성 통과와 Gatekeeper 허용은 별개다. 현재 생성물은 Gatekeeper에서 거부됐다. 개발자 배포 서명·공증 및 별도 Mac 설치 검증이 필요하다.
4. **DMG 실패를 성공 종료로 처리.** `scripts/package-mac.mjs`는 DMG 생성 오류를 잡아 경고만 출력한다. 따라서 `dist:mac`의 종료 코드만으로 DMG 생성 성공을 판단하면 안 된다.
5. **운영 가이드 설명 불일치.** 홈에는 PDF 업로드가 있지만 가이드에는 “PDF 발표는 준비 중이며 현재는 데모 덱만 발표할 수 있습니다.”가 표시된다. 로컬 `src/pages/GuidePage.tsx:16`에도 같은 문구가 있다.
6. **테스트 환경 제한.** 프런트엔드 테스트에서 jsdom Canvas `getContext()` 미구현 경고가 출력됐다. 테스트 통과가 실제 Canvas 렌더링 검증을 의미하지 않는다.

## 검증 범위의 한계

- 실제 카메라 허용, 손 인식, 두 창의 카메라 공유, Safari 실기기, 실제 PDF 렌더링 및 Electron 외부 앱 제어를 수동으로 검증하지 않았다.
- 운영 자산 검사는 HTTP 가용성·콘텐츠 유형 검사이며 모든 파일의 내용 일치나 실행 결과를 보장하지 않는다.
- 배포 제공자 대시보드의 배포 커밋·로그는 확인하지 않았다. 운영 반영 여부는 제공 중인 번들로 확인했다.
- 이번 작업은 검증과 로컬 패키지 생성이다. 운영 배포·푸시·소스 수정은 수행하지 않았다.

생성물: `release/Adam.app`, `release/Adam-1.0.0-arm64.zip`, `release/Adam-1.0.0-arm64.dmg`.
