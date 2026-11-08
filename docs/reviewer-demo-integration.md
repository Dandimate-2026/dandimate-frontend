# 심사용 데모 연동

- 진입: `/reviewer-demo`. 로그인 화면과 내 모임방의 ‘심사용 데모 체험하기’ 링크로 접근한다.
- 카카오 로그인 후 ‘체험 방 열기’를 눌러 `POST /api/v1/reviewer-demo/activate`를 호출한다. 기존 클라이언트의 세션 쿠키와 CSRF 처리를 사용한다.
- 응답의 `hostRoomId`, `memberRoomId`는 방 홈으로, `completedRoomId`는 두루마리 화면으로 연결한다.
- 백엔드는 로그인 계정별 방 3개를 생성하고, 재요청 시 기존 방을 반환한다. 페이지 진입만으로 활성화 요청을 보내지 않는다.
- 서버의 `app.reviewer-demo.enabled`가 꺼져 있으면 403 오류 메시지를 표시한다. 프런트에서 권한이나 샘플 데이터를 대체하지 않는다.

## 확인한 계약

공개 OpenAPI에는 아직 심사용 엔드포인트가 없어 백엔드 main의 다음 소스를 기준으로 연결했다.

- [ReviewerDemoController](https://github.com/Dandimate-2026/dandimate-backend/blob/main/src/main/java/com/dandimate/durooduroo/reviewerdemo/controller/ReviewerDemoController.java)
- [ReviewerDemoView](https://github.com/Dandimate-2026/dandimate-backend/blob/main/src/main/java/com/dandimate/durooduroo/reviewerdemo/dto/ReviewerDemoView.java)
- [ReviewerDemoService](https://github.com/Dandimate-2026/dandimate-backend/blob/main/src/main/java/com/dandimate/durooduroo/reviewerdemo/service/ReviewerDemoService.java)
- [ReviewerDemoFlowTest](https://github.com/Dandimate-2026/dandimate-backend/blob/main/src/test/java/com/dandimate/durooduroo/reviewerdemo/ReviewerDemoFlowTest.java)

## 검증

TypeScript와 변경 파일 ESLint 통과. Chromium에서 API 응답을 가로채 로그인 리디렉션, 명시적 활성화, CSRF 헤더, 비활성화 오류와 재시도, 방 3개의 이동 경로 및 페이지 오류 없음을 확인했다.

실제 로그인 계정으로 운영 서버에 방을 생성하는 검증은 수행하지 않았다. 백엔드 샘플 사진은 현재 1×1 PNG라 실제 여행 사진은 표시되지 않는다.
