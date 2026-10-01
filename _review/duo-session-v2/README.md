# Duo Session V2 review

이 폴더의 캡처는 disposable local Supabase와 loopback production Next 서버에서 A/B/C 및 동일 인증의 두 번째 B 브라우저 context로 생성한다.

- `host-invite-ready.png`: 호스트의 2시간 보안 링크 준비 상태
- `visitor-join.png`: 인증 방문자의 URL token 제거 후 입장
- `worldmap-two-players.png`: WorldMap 양방향 실시간 표시
- `interior-two-players.png`: 저장된 호스트 방의 Interior 실시간 표시
- `visitor-readonly.png`: 방문자의 상점·편집·저장 부재
- `session-full-third-user.png`: 세 번째 인증 사용자의 `session_full` 차단
- `second-tab-blocked.png`: 동일 방문자의 두 번째 탭 차단
- `reconnect-notice.png`: 같은 mount의 실제 연결 상실 안내
- `invite-revoked.png`: 호스트 종료 후 저장 방 읽기 전용 fallback
- `mobile-portrait.png`: 390×844
- `mobile-landscape.png`: 844×390

페이지 캡처에는 주소 표시줄이 들어가지 않으며, UI는 join token·session UUID·participant/auth ID·service key를 렌더하지 않는다. 테스트는 링크를 브라우저 clipboard stub에서만 읽고 로그나 산출물에 출력하지 않는다. URL query는 join 네트워크 요청 전에 제거되며, 성공 후 recovery storage에는 session ID·동일 client ID·role만 남는다.

2026-10-01 최종 검토에서 11개 PNG의 크기와 화면을 직접 확인했고, 파일 payload/metadata 문자열 스캔과 E2E의 DOM·event·storage 검사를 통과했다. `interior-two-players.png`와 `worldmap-two-players.png`는 시작 좌표를 분리해 두 캐릭터가 시각적으로 확인되며, `invite-revoked.png`는 종료 후 저장 방 읽기 전용 fallback 안내를 표시한다.
