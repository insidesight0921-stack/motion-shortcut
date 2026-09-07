# 모션 단축키

웹캠으로 한 손 제스처를 인식해 요리 모드 화면(조리 영상, 조리 단계, 타이머)을 손대지 않고 조작하는 웹앱. 팀 "곰팡이", 원티드 해커톤.

## 실행

```bash
pnpm install
pnpm dev
```

브라우저에서 http://localhost:5173 을 연다.

## 카메라 권한과 HTTPS

- 브라우저는 `localhost` 또는 HTTPS 페이지에서만 카메라를 열어 준다. `http://192.168.x.x:5173` 같은 LAN 주소로는 카메라가 열리지 않는다.
- 팀원과 배포 테스트를 하려면 Vercel, GitHub Pages 같은 HTTPS 호스팅이 필요하다.
- 처음 접속 시 카메라 권한 팝업에서 "허용"을 눌러야 한다. 거부했다면 주소창 왼쪽 자물쇠 아이콘에서 다시 허용할 수 있다.

## 개발

```bash
pnpm test    # 유닛 테스트 (인식 로직, 카메라 불필요)
pnpm build   # 타입 검사 + 프로덕션 빌드
```

자세한 구조와 규칙은 [CLAUDE.md](./CLAUDE.md), 결정 기록은 [docs/DECISIONS.md](./docs/DECISIONS.md), 제스처 규칙은 [docs/GESTURES.md](./docs/GESTURES.md)를 본다.
