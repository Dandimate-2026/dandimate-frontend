# 백엔드 연동 현황

공개 Swagger 0.1.0과 현재 프론트 기준으로, 서버 계약이 없거나 응답 필드가 부족한 부분을 정리한 문서입니다.

## 1. 백엔드 API가 없어 프론트에서 임시 처리 중

| 기능 | 현재 동작 | 위치 |
|---|---|---|
| 카카오 로그인 | 로그인 API 없음. 누르면 기기에 로그인 표시만 저장 | `src/lib/auth.ts` |
| 결제·쿠폰 | 공개 Swagger 0.1.0에 API 없음. 실제 모드에서는 결제 버튼을 비활성화 | `src/api/plans.ts`, `src/pages/RoomCheckoutPage.tsx` |
| 플랜·가격 | 시안 예시 값을 프론트에 하드코딩 | `src/lib/plans.ts` |
| 시안 미리보기 | `memories.html`은 서버를 호출하지 않는 독립 시안 | `src/features/memories/MemoryPreview.tsx` |
| 두루마리 답가 본문 목록 | 공개 응답에 `replyCount`만 있고 답가 본문 목록은 없음 | `src/features/memories/LiveScrollPage.tsx` |
| 내 반응·평가 조회 | 공개 응답에 현재 사용자의 반응/평가 값이 없어 새로고침 후 선택 상태를 복원할 수 없음 | `src/features/memories/LiveScrollPage.tsx` |
| 방 나가기 | 나가기 API 없음. 이 기기에 저장된 방 정보만 지움 | `src/pages/RoomSettingsPage.tsx` |

## 2. 응답·요청에 필드가 없어 비워두거나 대체 중

| 필요한 것 | 현재 동작 | 위치 |
|---|---|---|
| 내 모임방 목록 | 목록 API 없음. 이 기기에 저장된 방만 표시하므로 기기를 바꾸면 사라짐 | `src/lib/session.ts` |
| 방 목록 대표 사진 | 응답에 없어 빈 칸 | `src/pages/RoomListPage.tsx` |
| 방 목록 답가 수 | 응답에 없어 안 읽은 알림 수로 대체 | `src/pages/RoomListPage.tsx` |
| 초대한 사람 이름 | `InvitePreview` 응답에 없음 | `src/pages/InviteJoinPage.tsx` |
| 방 만들 때 인원 `capacity` | 생성 요청 계약에 필드가 없어 보내지 않음. 화면에는 최대 8명으로 표시 | `src/api/types.ts`, `src/pages/RoomCreatePage.tsx` |
| 방별 정원 | 홈에서 8명 고정 상수(`ROOM_CAPACITY`)로 표시 | `src/pages/RoomHomePage.tsx` |
| 약관 동의 버전 | `'2026-10'` 임시 값 | `src/api/rooms.ts` |

## 3. 모임방 설정에 필요한 API

- 방 나가기
- 멤버 목록 조회 (지금은 모임방 홈 응답의 `members`를 사용)
- 닉네임 변경, 방 이름·모임 날짜 변경 (프론트는 `PATCH /rooms/{roomId}`, `PATCH /rooms/{roomId}/members/me`로 가정해 화면만 만들어 둠)
- 초대 링크 재발급
- 방장 위임, 방 삭제
- 방장이 아닌 사람에게도 초대 링크 제공 (지금은 방장 기기에만 원본 초대 토큰이 있음)

## 4. 기획·디자인 확인 필요

- 카카오 공유: SDK는 붙였으나 JavaScript 키(`VITE_KAKAO_JS_KEY`)와 도메인 등록 필요. 키가 없으면 기기 공유창으로 대체 (`src/lib/kakao.ts`)
- 꽃 색: 시안의 3색 외 나머지 (`src/lib/flower.ts`)
- 뒤로 가기 목적지: 사진 올리기, 첫 한마디 화면
- 약관·개인정보 문구: 초안 상태 (`src/pages/PolicyPage.tsx`)
- 환불 안내: 별도 문서 없음, 이용약관으로 연결
- 모임 이름 글자 수: 시안 20자, 코드 10자
- 방장이 나가면 어떻게 할지 (위임 / 방 종료)
- 방을 만든 뒤 인원 변경: 플랜별 인원 한도, 인원을 늘리면 결제로 연결하는지

## 백엔드 요청 우선순위

1. 로그인 API와 로그인 기준 내 방 목록 API
2. 방별 정원을 선택해야 한다면 생성 요청의 `capacity`와 홈 응답의 정원 필드 추가
3. 결제·쿠폰 API와 PG 연동 계약, 두루마리 답가 본문/내 반응·평가 조회 필드
4. 방 나가기와 설정 관련 API
5. 응답 필드 추가: 초대한 사람 이름, 대표 사진, 답가 수
