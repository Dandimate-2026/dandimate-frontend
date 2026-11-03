# 백엔드 연동 현황

백엔드 Swagger 명세(`Duruduru Public API` 0.1.0)와 현재 프론트 코드를 비교해 정리한 문서입니다.

- API Base URL: https://43-201-73-60.sslip.io/api/v1
- Swagger: https://43-201-73-60.sslip.io/swagger-ui.html
- 명세 원본: `dandimate-backend` 저장소 `docs/swagger/openapi.yaml`

## 0. 인증 방식 변경 (반영 완료)

백엔드가 방별 참가자 토큰(Bearer)에서 **카카오 로그인 세션 쿠키 + CSRF 토큰**으로 바뀌어 프론트를 맞췄습니다.

| 항목 | 프론트 반영 |
|---|---|
| 카카오 로그인 | 로그인 버튼 → `/oauth2/authorization/kakao`로 이동. 로그인 확인은 `GET /users/me` |
| 로그아웃 | 내 모임방 목록 상단 "로그아웃" → `POST /auth/logout` |
| 쿠키·CSRF | 모든 요청에 `credentials: 'include'`. 쓰기 요청에 `GET /auth/csrf`로 받은 `X-CSRF-TOKEN`. 403이면 토큰을 새로 받아 한 번 다시 시도 |
| 내 모임방 목록 | `GET /users/me/rooms` (기기를 바꿔도 보임) |
| 방 만들기 | `planType`(지금은 `FREE`)과 `capacity`(2~8명 드롭다운) 전송 |

**로컬 개발 주의:** 카카오 로그인 콜백은 배포 서버 도메인에서 세션 쿠키를 만듭니다. `localhost:5173`에서는 이 쿠키를 쓸 수 없어 로그인 상태가 유지되지 않습니다. 로컬에서 실제 로그인을 확인하려면 백엔드에서 로그인 후 돌아갈 프론트 주소와 쿠키 설정을 로컬용으로 맞춰야 합니다. 화면만 볼 때는 `VITE_USE_MOCK=true`를 씁니다.

## 1. 백엔드에 API가 없어 프론트에서 임시 처리 중

| 기능 | 현재 동작 | 위치 |
|---|---|---|
| 결제·플랜·쿠폰 | 결제·플랜·쿠폰 API 없음. 방 만들기의 `planType`이 LITE·PRO면 서버가 503(`PAYMENT_NOT_CONFIGURED`)을 주어 지금은 FREE로만 만듦. 가격·한도는 프론트 예시 값이며 실제 모드에서는 결제·쿠폰 입력을 비활성화함 | `src/api/plans.ts`, `src/lib/plans.ts`, `src/pages/RoomCheckoutPage.tsx` |
| 결제 화면 세부 | 결제 수단·약관·실패 사유·주문 번호는 서버 응답과 PG 계약이 없어 실제 결제 흐름으로 확인할 수 없음 | `src/pages/RoomCheckoutPage.tsx` |
| 방 나가기 | 나가기 API 없음. 이 기기에 저장된 방 정보만 지움 (서버에는 멤버로 남음) | `src/pages/RoomSettingsPage.tsx` |
| 내 이름 변경 | API 없음. 프론트는 `PATCH /rooms/{roomId}/members/me`로 가정해 둠 → 실제로는 실패 | `src/api/rooms.ts` |
| 방장 위임 | API 없음 | - |

## 2. 백엔드에 API가 있는데 프론트가 아직 안 쓰는 것

| API | 용도 | 프론트 현재 상태 |
|---|---|---|
| `DELETE /replies/{replyId}` | 내 답가 삭제 | 미연결. 두루마리 응답에 답가 목록(`replyId`)이 없어 지울 대상을 보여줄 수 없음 |
| `GET /rooms/{roomId}/askbacks/me` | 나에게 온 질문 목록 | 미사용. 홈의 `topAskback` 하나만 씀 |
| `POST /rooms/{roomId}/askbacks/run` | 데모용 질문 즉시 생성 (방장) | 미사용 |
| `PATCH·DELETE /entries/{entryId}` | 내 이야기 수정·삭제 | 화면 없음. 내 이야기 목록을 주는 API가 없어 `entryId`를 알 수 없음 |
| `DELETE /photos/{photoId}` | 내 사진 삭제 | 화면 없음. 내 사진 목록을 주는 API가 없어 `photoId`를 알 수 없음 |

## 3. 응답에 필드가 없어 비워두거나 대체 중

| 필요한 것 | 현재 동작 | 위치 |
|---|---|---|
| 방 목록 대표 사진 | 홈 응답에 없어 빈 칸 | `src/pages/RoomListPage.tsx` |
| 방 목록 답가 수 | 홈 응답에 없어 `unreadCount`로 대체 | `src/pages/RoomListPage.tsx` |
| 초대한 사람 이름 | `InvitePreviewResponse`에 없음 | `src/pages/InviteJoinPage.tsx` |
| 멤버에게 초대 링크 | 원본 초대 토큰은 방 만들 때(또는 재발급 때) 방장에게만 한 번 내려옴. 멤버는 링크를 공유할 수 없음 | `src/lib/session.ts` |
| 약관 동의 버전 | 명세에 값이 정해져 있지 않아 `'2026-10'` 임시 값 | `src/api/rooms.ts` |
| 두루마리 답가 본문 | 응답에 `replyCount`만 있어 답가 목록을 다시 표시할 수 없음 | `src/features/memories/LiveScrollPage.tsx` |
| 내 반응·평가 | 현재 사용자의 반응·평가 값이 없어 새로고침 후 선택 상태를 복원할 수 없음 | `src/features/memories/LiveScrollPage.tsx` |

## 4. 기획·디자인 확인 필요

- 플랜 선택 순서: 서버는 방을 만들 때 플랜을 받음. 결제가 붙으면 플랜 선택 → 결제 → 방 만들기 순서로 바꿔야 함
- 카카오 공유: SDK는 붙였으나 JavaScript 키(`VITE_KAKAO_JS_KEY`)와 도메인 등록 필요. 키가 없으면 기기 공유창으로 대체 (`src/lib/kakao.ts`)
- 방장이 나가면 어떻게 할지 (위임 / 방 종료)
- 꽃 색: 시안의 3색 외 나머지 (`src/lib/flower.ts`)
- 뒤로 가기 목적지: 사진 올리기, 첫 한마디 화면
- 약관·개인정보 문구: 초안 상태 (`src/pages/PolicyPage.tsx`)
- 환불 안내: 별도 문서 없음, 이용약관으로 연결

## 다음 할 일

**프론트**
1. 유효한 테스트 방과 참여 토큰으로 돌려보기·엮기·답가 쓰기 흐름 검증

**백엔드에 요청**
1. 로컬 개발용 로그인 후 돌아갈 주소·쿠키 설정
2. 결제 범위 결정 (1차 범위 밖이면 결제 화면을 데모용으로 둘지), 필요하면 플랜·결제·쿠폰 API
3. 방 나가기, 내 이름 변경 API
5. 응답 필드 추가: 초대한 사람 이름, 방 대표 사진, 답가 수
6. 내 사진·이야기 목록 API, 두루마리 응답에 답가 목록 (사진·이야기·답가 삭제 화면에 필요)
