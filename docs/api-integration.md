# 배포 API 연결 및 확인

2026-11-06 추가한 평가 숨김·템플릿·파일 다운로드·평가 후 재엮기는 [두루마리 기능 연결 및 검증](scroll-features.md)을 먼저 참고하세요. 최신 스웨거의 인증은 로그인 쿠키와 CSRF 토큰이며, 아래의 기존 방별 토큰 설명보다 새 문서의 두루마리 연결 기준이 우선합니다.

기준: [Swagger UI](https://43-201-73-60.sslip.io/swagger-ui.html) / [OpenAPI 원문](https://43-201-73-60.sslip.io/openapi/public-api.yaml), Duruduru Public API 0.1.0.

## 연결된 화면

| 화면 | API |
|---|---|
| 돌려보기 카드 | `GET /rooms/{roomId}/circulation` (커서 페이지 전체 조회) |
| 패스 / 패스 취소 | `PUT` / `DELETE /photos/{photoId}/passes/me` |
| 덧붙임 | `POST /photos/{photoId}/transcriptions` (음성), `POST /photos/{photoId}/entries` (`kind: ADDON`) |
| 엮는 중 | `GET /jobs/{jobId}`, `GET /rooms/{roomId}` 5초 간격 조회, 완료 후 `GET /rooms/{roomId}/scroll` |
| 실패한 엮기 재시도 | `POST /rooms/{roomId}/weave-jobs` (방장) |
| 두루마리·원문 | `GET /rooms/{roomId}/scroll`의 `paragraphs`와 `sources` |
| 아 맞다·문단 평가 | `PUT` / `DELETE /paragraphs/{paragraphId}/reactions/ah-matda`, `PUT /paragraphs/{paragraphId}/fidelity-rating` |
| 답가 | `POST /paragraphs/{paragraphId}/transcriptions` (음성), `POST /paragraphs/{paragraphId}/replies`, `GET /jobs/{jobId}` |

요청은 방 입장/생성 시 받은 `memberAccessToken`을 Bearer 토큰으로 보냅니다. 덧붙임·답가 저장 및 엮기 재시도에는 `Idempotency-Key`를 보냅니다. 쓰기 후에는 카드나 두루마리를 서버에서 다시 읽습니다.

## 로컬에서 확인

1. `npm ci` 후 `npm run dev`를 실행합니다. `.env.local`이 없다면 Vite가 `/api` 요청을 `https://43-201-73-60.sslip.io`로 프록시합니다. `.env.local`의 `VITE_USE_MOCK`은 비우거나 `false`로 둡니다.
2. 앱에서 방을 만들거나 초대 링크로 입장합니다. 방 정원은 공개 API 계약상 8명 고정입니다. 현재 로그인 버튼은 프론트 로컬 상태이고, 방 API 인증은 방별 참여 토큰으로 동작합니다.
3. 두 사용자(다른 브라우저 프로필/기기)를 방에 입장시키고 친구 사진과 첫 이야기를 올립니다. 방 홈 → **이야기 붙이기**에서 카드가 실제 사진과 이야기로 채워지는지 확인합니다.
4. **패스**와 **패스 취소**, 글 또는 음성 **덧붙이기**를 실행합니다. 개발자 도구 Network에서 위 경로의 2xx 응답과 뒤따르는 `GET /circulation`을 확인합니다. 새로고침 후에도 응답 상태가 유지되어야 합니다.
5. 방장이 엮기를 시작하면 `GET /jobs/{jobId}`의 `status`가 `SUCCEEDED`가 될 때 두루마리가 열립니다. 홈의 **두루마리 보기**로 다시 들어가도 서버 문단이 보여야 합니다. 문단별 **원문보기**, **아 맞다**, **평가**, **답가**를 확인합니다. 답가는 202 작업 완료 후 문단이 갱신됩니다.
6. UI 시안만 보려면 `memories.html`을 엽니다. 이 경로는 서버 저장을 확인하는 용도가 아닙니다.

## 서버 계약상 남은 부분

- 공개 Swagger에는 플랜 조회, 쿠폰 검증, 주문·결제·결제 결과 조회 API가 없습니다. 실제 모드에서는 결제 버튼을 비활성화하고 성공 화면으로 이동하지 않습니다. 결제창·실패 사유·영수증·환불은 API 계약과 결제대행 연동이 있어야 검증할 수 있습니다.
- `ScrollResponse.paragraphs`는 `replyCount`만 제공하고 답가 본문 목록은 제공하지 않습니다. `ahMatdaCount`와 평가 저장 API에도 현재 사용자의 선택 값이 없어 새로고침 후 선택 표시를 복원할 수 없습니다.
- API의 `servers` 항목은 `api.example.com` 예시 값이므로 실제 배포 주소는 위 URL을 사용합니다. 로컬 Chrome에서 배포 API를 직접 `fetch`하면 실패했고, Vite의 같은 출처 `/api` 프록시를 통한 요청은 서버 JSON 응답을 받았습니다. 다른 도메인에 프론트를 배포한다면 백엔드 CORS 허용 또는 같은 출처 리버스 프록시가 필요합니다.
