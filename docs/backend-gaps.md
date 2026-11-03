# 백엔드 연동 현황

배포 서버의 공개 API 명세(`두루두루 공개 API` 0.1.0, 2026-11-03 다시 받음)와 `feature/develop`(PR #27 머지 시점) 프론트 코드를 엔드포인트 단위로 비교한 문서입니다.

- API: https://43-201-73-60.sslip.io/api/v1
- Swagger: https://43-201-73-60.sslip.io/swagger-ui.html
- 명세 원문: https://43-201-73-60.sslip.io/openapi/public-api.yaml

표시: 🔴 실제 서버에서 오류가 나는 것 · 🟡 동작은 하지만 계약과 다른 것 · ⚪ 참고

## 1. 계약이 맞지 않는 것 (프론트 수정 필요)

| | 내용 | 실제 서버에서 생기는 일 | 위치 |
|---|---|---|---|
| 🔴 | 받아쓰기 3곳(`POST /photos/{id}/transcriptions`, `/askbacks/{id}/transcriptions`, `/paragraphs/{id}/transcriptions`)은 `Idempotency-Key`가 필수인데 프론트가 보내지 않음 | 녹음할 때마다 400 "요청 키 누락" → 첫 한마디·되묻기·답가 음성이 전부 실패 | `src/api/entries.ts`, `askbacks.ts`, `memories.ts` |
| 🔴 | 녹음 최대 길이가 플랜별(첫 한마디 30/60/120초, 그 밖 20/30/60초)인데 프론트는 고정값(첫 한마디 60초, 되묻기·덧붙임 30초, 답가 60초) | Free 방에서 31초 이상 첫 한마디, 21초 이상 되묻기·덧붙임·답가는 서버가 422로 거절. 프론트는 422를 "말하기 시간을 모두 썼어요" 시트로 보여줘서 **잘못된 안내**가 뜸 | `FirstEntryPage.tsx`, `AskbackPage.tsx`, `ContributionSheet.tsx` |
| ✅ | 덧붙임 글 길이를 서버와 같은 200자로 맞춤 | - | `RoomCirculationPage.tsx` |
| ✅ | 홈 "내 사진 ○/○장"과 사진 고르기 장수를 플랜 한도(`quota.photosPerMember`, `myPhotosRemaining`)로 맞춤. 사진이 3장 넘게 되면 칸이 여러 줄이 되고, 길게 눌러 순서 바꾸기도 여러 줄에서 동작 | - | `RoomHomePage.tsx`, `PhotoUploadPage.tsx` |
| ⚪ | `capacity`는 서버가 1~8명을 받는데 프론트 드롭다운은 2~8명 | 문제 없음 (혼자 쓰는 방은 막아 둠) | `RoomCreatePage.tsx` |

## 2. 프론트에만 있는 것 (백엔드 API 없음)

| 기능 | 지금 동작 | 필요한 API | 위치 |
|---|---|---|---|
| 결제·플랜 변경 | mock에서만 결제 성공 처리. 실제 모드는 결제 버튼 비활성. 방 만들기는 `planType: FREE` 고정 (LITE·PRO는 서버가 503) | 결제·결제 검증, **이미 만든 방의 플랜 변경** | `src/api/plans.ts`, `RoomCheckoutPage.tsx` |
| 쿠폰 | mock에서만 입력 가능 | 쿠폰 검증 | `RoomCheckoutPage.tsx` |
| 플랜 가격·설명 | 프론트 하드코딩 (Free 0원 / Lite 2,900원 / Pro 5,900원) | 플랜 조회 (선택) | `src/lib/plans.ts` |
| 방장에게 플랜 변경 요청 | `POST /rooms/{id}/plan-requests` `{ reason: PHOTO·VOICE·REWEAVE }`로 가정. 실패하면 기기 공유창으로 직접 부탁 | 요청 API + 알림 종류 `PLAN_UPGRADE_REQUESTED` (명세 알림 종류는 `ASKBACK_RECEIVED`·`SCROLL_READY`·`REPLY_APPLIED` 3개뿐) | `src/api/rooms.ts`, `RoomNotificationsPage.tsx` |
| 내 이름(닉네임) 변경 | `PATCH /rooms/{id}/members/me`로 가정 → 실제 서버에서 실패 ("아직 바꿀 수 없어요") | 닉네임 변경 | `src/api/rooms.ts` |
| 멤버 방 나가기 | 이 기기 저장 정보만 지움. 내 방 목록은 서버(`/users/me/rooms`)에서 오므로 **새로고침하면 방이 다시 나타남** | 방 나가기 | `RoomSettingsPage.tsx` |
| 방장 위임 | 없음. 방장은 나가기 대신 방 삭제만 보임 | 방장 위임 | - |
| 데모 역할 선택 | mock 로그인에서 방장·멤버 선택 | 없음 (데모 전용) | `LoginPage.tsx`, `src/api/mock.ts` |

## 3. 백엔드에 있는데 프론트가 안 쓰는 것

| API | 용도 | 비고 |
|---|---|---|
| `DELETE /photos/{photoId}` | 내 사진 삭제 | 내 사진 목록 API가 없어 지울 사진을 보여줄 수 없음 |
| `PATCH·DELETE /entries/{entryId}` | 내 이야기 수정·삭제 | 내 이야기 목록 API가 없어 `entryId`를 알 수 없음 |
| `DELETE /replies/{replyId}` | 내 답가 삭제 | 두루마리 응답에 답가 목록이 없음 |
| `GET /rooms/{roomId}/askbacks/me` | 나에게 온 질문 목록 | 홈의 `topAskback` 하나만 보여줌 |
| `POST /rooms/{roomId}/askbacks/run` | 데모용 질문 바로 만들기 (방장) | 시연에 쓸 수 있음. 버튼 없음 |

## 4. 응답에 없어서 비워두거나 대신 쓰는 것

| 필요한 것 | 지금 동작 | 위치 |
|---|---|---|
| 방 목록의 상태·할 일·대표 사진 | `/users/me/rooms`는 이름·상태·역할만 줘서 방마다 `GET /rooms/{id}`를 한 번씩 더 부름. 대표 사진은 빈 칸 | `RoomListPage.tsx` |
| 방 목록 답가 수 | `unreadCount`로 대신 표시 | `RoomListPage.tsx` |
| 초대한 사람 이름 | `GET /invites/{token}` 응답에 없음 | `InviteJoinPage.tsx` |
| 멤버·다른 기기의 초대 링크 | 원본 초대 토큰은 방 만들 때와 재발급할 때 방장에게 한 번만 옴. 다른 기기로 로그인한 방장은 설정에서 "링크 새로 만들기"를 해야 링크가 보임 | `src/lib/session.ts` |
| 두루마리 답가 본문, 내 반응·평가 | `replyCount`·`ahMatdaCount`만 있어 새로고침하면 내 선택이 사라짐 | `LiveScrollPage.tsx` |
| 한도 초과 오류 코드 | 422 하나로만 와서 사진·말하기·재엮기를 화면별로 추측 | `src/hooks/useRoomQuota.ts` |
| 약관 동의 버전 | 정해진 값이 없어 `'2026-10'` 임시 값 | `src/api/rooms.ts` |

## 5. 프론트 흐름에서 이상한 것

1. ~~로그인이 필요한데 "가입 없이"라고 안내함~~ → 고침. 방 만들기 "링크 하나로 친구들과 함께 써요", 초대 입장 "이름만 정하면 바로 들어갈 수 있어요"
2. **플랜을 방 만든 뒤에 고름.** 서버는 방을 만들 때만 플랜(`planType`)을 받고, 방 수정(`PATCH /rooms/{id}`)은 이름·모임 날짜·마감 시각만 바꿀 수 있음. 프론트는 FREE로 먼저 만들고(LITE·PRO는 서버가 503) 플랜 화면을 보여주므로, 여기서 Lite를 골라도 적용할 방법이 없음 → 백엔드에 "이미 만든 방의 플랜 변경" 또는 "플랜 선택 → 결제 → 방 만들기" 순서 중 하나를 정해야 함
3. **나가기 후 방이 되살아남.** 서버 목록 기준이라 새로고침하면 다시 보임 → 백엔드 나가기 API 필요
4. **멤버가 모임방 홈 아래 "단톡방에 알리기"를 누를 때.** 방장은 초대 링크를 보내지만, 멤버는 원본 초대 토큰이 없어서 초대 링크 대신 모임방 홈 주소를 보냄. 이미 들어온 친구는 바로 열 수 있지만, 아직 안 들어온 친구는 들어갈 수 없음
5. **시간 종료 시트.** 마감 시각이 지나면 서버가 자동으로 엮는지 명세에 없음. 자동이라면 시트 문구를 바꿔야 함
6. **로컬에서 실제 로그인이 안 됨.** 로그인 쿠키가 배포 서버 도메인에 `SameSite=Lax`로 생기고 CORS도 `localhost`를 막아서, 로컬은 mock으로만 확인 가능
7. **로그아웃이 내 모임방 목록에만 있음.**

## 6. 시안 없이 프론트에서 새로 만들거나 바꾼 것 (디자인 확인 필요)

시안을 받은 화면(함께할 인원 드롭다운, 엮을 수 있는 방 홈, 플랜 한도 시트 3종)은 제외했습니다. 아래는 기존 화면 스타일을 따라 프론트에서 임의로 만든 것이라 디자이너 확인이 필요합니다.

| 화면 | 새로 만들거나 바꾼 것 | 위치 |
|---|---|---|
| 로그인 | 데모 모드에서만 "방장으로 / 멤버로 시작하기" 두 버튼 | `LoginPage.tsx` |
| 내 모임방 목록 | 오른쪽 위 **로그아웃** 글자 버튼 | `RoomListPage.tsx` |
| 내 모임방 목록 | 데모 모드 "데모 · 방장으로 보는 중" 분홍 표시 | `RoomListPage.tsx` |
| 내 모임방 목록 | 방 카드의 상태 배지 옆 **내 꽃 · 닉네임 · 방장** 표시 | `RoomListPage.tsx` |
| 모임방 홈 | 오른쪽 위 **🔔 알림 버튼**(안 읽은 개수 배지)과 **⚙️ 설정 버튼**(꽃잎 모양 톱니바퀴) | `RoomHomePage.tsx` |
| 모임방 홈 | "단톡방에 알리기"가 공유 화면 이동 대신 **바로 공유창**을 엶 | `RoomHomePage.tsx` |
| 모임방 홈 | 완성된 방 아래 카드 "첫 두루마리가 완성됐어요 / 답가를 달면 두루마리가 계속 자라요" + 두루마리 보기 | `RoomHomePage.tsx` |
| 모임방 홈 | **시간 종료 바텀시트** (방장: 엮으러 가기 / 조금 있다가 할게요, 멤버: 확인) | `RoomHomePage.tsx` |
| 모임방 설정 (화면 전체) | 모임 정보(이름·날짜·첫 두루마리 시각 + 변경), 초대 링크(복사·단톡방에 보내기·링크 새로 만들기), 함께하는 사람(이름 변경), 안내(약관 링크), 나가기·삭제 버튼 | `RoomSettingsPage.tsx` |
| 모임방 설정 | 변경 창(이름·날짜·시각 입력), 확인 창(나가기·링크 새로 만들기·방 삭제) | `RoomSettingsPage.tsx` |
| 알림 (화면 전체) | 알림 목록, 안 읽은 알림 분홍 배경과 점, "방금·○분 전" 표시, 플랜 변경 요청 알림 | `RoomNotificationsPage.tsx` |
| 사진 올리기 | 한도에 닿으면 **회색 잠금 칸**(🔒 더 올리려면) 또는 사진 아래 **회색 잠금 줄** | `PhotoUploadPage.tsx` |
| 사진·녹음 화면 | 방장에게 알린 뒤 "방장에게 알렸어요. 플랜이 바뀌면 바로 쓸 수 있어요" 안내 문구 | `useRoomQuota.ts` |
| 모임방 만들기·초대 입장 | "설치·가입 없이" 문구 삭제 | `RoomCreatePage.tsx`, `InviteJoinPage.tsx` |

## 다음 할 일

**프론트 (바로 할 수 있음)**
1. 🔴 받아쓰기 요청 3곳에 `Idempotency-Key` 추가
2. 🔴 녹음 최대 길이를 방 `quota.firstMaxSeconds`·`otherMaxSeconds`로 맞추고, 길이 초과(422)와 총량 소진을 구분
3. 로그아웃 위치 정하기
4. 6번 표의 새 화면·요소 디자인 확인

**백엔드에 요청**
1. 로컬 개발용 로그인 설정 (돌아갈 주소, CORS, 쿠키) 또는 프론트를 같은 서버에 배포
2. 결제·이미 만든 방의 플랜 변경 API
3. 방장에게 플랜 변경 요청 API와 알림 종류 `PLAN_UPGRADE_REQUESTED`
4. 방 나가기, 닉네임 변경, 방장 위임 API
5. 한도 초과 오류 코드 구분 (예: `PHOTO_LIMIT_EXCEEDED`, `VOICE_TOTAL_EXCEEDED`, `VOICE_TOO_LONG`, `REWEAVE_LIMIT_EXCEEDED`)
6. 응답 필드: 방 목록 대표 사진·답가 수, 초대한 사람 이름, 두루마리 답가 목록·내 반응·평가
7. 마감 시각이 지난 방을 서버가 자동으로 엮는지 확인
