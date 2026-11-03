# 백엔드 연동 현황

백엔드 Swagger 명세(`Duruduru Public API` 0.1.0)와 프론트 `feature/room-settings`(PR #21) 코드를 비교해 정리한 문서입니다.

- API Base URL: https://43-201-73-60.sslip.io/api/v1
- Swagger: https://43-201-73-60.sslip.io/swagger-ui.html
- 명세 원본: `dandimate-backend` 저장소 `docs/swagger/openapi.yaml`

## 0. 바로 고쳐야 하는 것

| 문제 | 내용 | 위치 |
|---|---|---|
| 방 만들기 `capacity` | 백엔드 `CreateRoomRequest`가 `additionalProperties: false`라 프론트가 보내는 `capacity`를 거절할 수 있음. 실제 서버에서는 방 만들기 실패 가능 | `src/pages/RoomCreatePage.tsx`, `src/api/types.ts` |
| 정원 | 백엔드는 정원을 8명 고정(`capacity: const 8`)으로 둠. 프론트 인원 드롭다운(2~8명)은 백엔드에 저장되지 않음 | 같은 곳 |
| 모임 이름 글자 수 | 백엔드는 20자까지 허용, 프론트는 10자로 막음 | `RoomCreatePage.tsx`, `RoomSettingsPage.tsx` |

## 1. 백엔드에 API가 없어 프론트에서 임시 처리 중

| 기능 | 현재 동작 | 위치 |
|---|---|---|
| 카카오 로그인 | 명세에 로그인·계정 API가 없음 (방마다 받는 `memberAccessToken`으로만 인증). 지금은 기기에 로그인 표시만 저장 | `src/lib/auth.ts` |
| 내 모임방 목록 | 목록 API 없음. 이 기기에 저장된 방만 보여서 기기를 바꾸면 사라짐 | `src/lib/session.ts` |
| 결제·플랜 | 결제·플랜 API 없음. 가격·한도는 프론트 하드코딩, 누르면 결제된 것으로 처리 | `src/api/plans.ts`, `src/lib/plans.ts` |
| 방 나가기 | 나가기 API 없음. 이 기기에 저장된 방 정보만 지움 (서버에는 멤버로 남음) | `src/pages/RoomSettingsPage.tsx` |
| 내 이름 변경 | API 없음. 프론트는 `PATCH /rooms/{roomId}/members/me`로 가정해 둠 → 실제로는 실패 | `src/api/rooms.ts` |
| 방장 위임 | API 없음 | - |

## 2. 백엔드에 API가 있는데 프론트가 아직 안 쓰는 것

| API | 용도 | 프론트 현재 상태 |
|---|---|---|
| `PATCH /rooms/{roomId}` | 방장이 이름·날짜·마감 시각 변경 | 이름·날짜 변경에 연결됨 (주소·요청 모양 일치). 마감 시각(`deadlineAt`) 변경 화면은 없음 |
| `DELETE /rooms/{roomId}` | 방장이 방과 모든 내용 삭제 | 화면 없음 |
| `POST /rooms/{roomId}/invite-token/rotate` | 방장이 초대 링크 재발급 | 화면 없음 |
| `GET /rooms/{roomId}/circulation` | 돌려보기 카드 | 미연결. 시안 사진 2장 표시 (`RoomCirculationPage.tsx`) |
| `PUT·DELETE /photos/{photoId}/passes/me` | 돌려보기에서 사진 넘기기 | 미연결 |
| `GET /rooms/{roomId}/scroll` | 두루마리와 문단 | 미연결. 시안 데이터 표시 (`features/memories/data.ts`) |
| `GET /jobs/{jobId}` | 엮기 진행 상태 | 미연결 (`RoomWeavingPage.tsx`) |
| `POST /rooms/{roomId}/weave-jobs` | 엮기 실패 시 다시 시도 | 미연결 |
| `POST /paragraphs/{id}/replies`, `/transcriptions` | 덧붙임(답가)과 음성 받아쓰기 | 미연결. memories 화면 안에서만 동작 (`ContributionSheet.tsx`) |
| `DELETE /replies/{replyId}` | 내 덧붙임 삭제 | 미연결 |
| `PUT·DELETE /paragraphs/{id}/reactions/ah-matda` | "아 맞다!" 반응 | 미연결. 화면 안에서만 숫자 증가 (`ScrollPage.tsx`) |
| `PUT /paragraphs/{id}/fidelity-rating` | 문단이 기억과 맞는지 평가 | 화면 없음 |
| `GET /rooms/{roomId}/askbacks/me` | 나에게 온 질문 목록 | 미사용. 홈의 `topAskback` 하나만 씀 |
| `POST /rooms/{roomId}/askbacks/run` | 데모용 질문 즉시 생성 (방장) | 미사용 |
| `PATCH·DELETE /entries/{entryId}` | 내 이야기 수정·삭제 | 화면 없음 |
| `DELETE /photos/{photoId}` | 내 사진 삭제 | 화면 없음 |
| `GET /rooms/{roomId}/notifications`, `POST /notifications/{id}/read` | 알림 목록·읽음 | 화면 없음 |
| `GET /rooms/{roomId}/events`, `POST /rooms/{roomId}/event-token` | 실시간 갱신 (SSE, 안 되면 5초 폴링) | 미사용. 홈은 들어올 때 한 번만 불러옴 |

## 3. 응답에 필드가 없어 비워두거나 대체 중

| 필요한 것 | 현재 동작 | 위치 |
|---|---|---|
| 방 목록 대표 사진 | 홈 응답에 없어 빈 칸 | `src/pages/RoomListPage.tsx` |
| 방 목록 답가 수 | 홈 응답에 없어 `unreadCount`로 대체 | `src/pages/RoomListPage.tsx` |
| 초대한 사람 이름 | `InvitePreviewResponse`에 없음 | `src/pages/InviteJoinPage.tsx` |
| 멤버에게 초대 링크 | 원본 초대 토큰은 방 만들 때(또는 재발급 때) 방장에게만 한 번 내려옴. 멤버는 링크를 공유할 수 없음 | `src/lib/session.ts` |
| 약관 동의 버전 | 명세에 값이 정해져 있지 않아 `'2026-10'` 임시 값 | `src/api/rooms.ts` |

## 4. 기획·디자인 확인 필요

- 정원: 백엔드는 8명 고정. 인원 선택을 살릴지, 플랜별 정원으로 갈지 결정 필요 (살리면 백엔드 명세 변경 필요)
- 로그인: 명세는 계정 없이 방 토큰만 쓰는 구조. 카카오 로그인을 유지할지 결정 필요
- 카카오 공유: SDK는 붙였으나 JavaScript 키(`VITE_KAKAO_JS_KEY`)와 도메인 등록 필요. 키가 없으면 기기 공유창으로 대체 (`src/lib/kakao.ts`)
- 방장이 나가면 어떻게 할지 (위임 / 방 종료)
- 꽃 색: 시안의 3색 외 나머지 (`src/lib/flower.ts`)
- 뒤로 가기 목적지: 사진 올리기, 첫 한마디 화면
- 약관·개인정보 문구: 초안 상태 (`src/pages/PolicyPage.tsx`)
- 환불 안내: 별도 문서 없음, 이용약관으로 연결

## 다음 할 일

**프론트**
1. 방 만들기 요청에서 `capacity` 빼기 (백엔드가 받기 전까지)
2. 모임 이름 글자 수 20자로 맞추기
3. 돌려보기·두루마리·엮기 진행·덧붙임·반응 API 연결
4. 설정에 초대 링크 재발급, 방 삭제 추가

**백엔드에 요청**
1. 로그인 정책 결정, 필요하면 로그인 기준 내 방 목록 API
2. 방 나가기, 내 이름 변경 API
3. 정원 정책이 정해지면 방 만들기에 인원 필드
4. 응답 필드 추가: 초대한 사람 이름, 방 대표 사진, 답가 수
