# 백엔드 연동 현황

`feature/develop`(PR #20 머지 시점) 기준으로, 백엔드와 연결되지 않았거나 프론트에만 있는 부분을 정리한 문서입니다.

## 1. 백엔드 API가 없어 프론트에서 임시 처리 중

| 기능 | 현재 동작 | 위치 |
|---|---|---|
| 카카오 로그인 | 로그인 API 없음. 누르면 기기에 로그인 표시만 저장 | `src/lib/auth.ts` |
| 결제 | 결제 API 없음. 누르면 결제된 것으로 처리 | `src/api/plans.ts` |
| 플랜·가격 | 시안 예시 값을 프론트에 하드코딩 | `src/lib/plans.ts` |
| 돌려보기 | `GET /rooms/{roomId}/circulation` 미연결. 시안 사진 2장 표시 | `src/pages/RoomCirculationPage.tsx` |
| 엮기·두루마리 | 엮기 작업 상태(`GET /jobs/{jobId}`)·두루마리 API 미연결. 시안 데이터로 표시 | `src/pages/RoomWeavingPage.tsx`, `src/features/memories/data.ts` |
| "아 맞다!" 반응 | 화면 안에서만 숫자 증가, 저장 안 됨 | `src/features/memories/ScrollPage.tsx` |
| 덧붙임(답가) | memories 화면 안에서만 동작, 서버로 보내지 않음 | `src/features/memories/ContributionSheet.tsx` |
| 방 나가기 | 나가기 API 없음. 이 기기에 저장된 방 정보만 지움 | `src/pages/RoomSettingsPage.tsx` |

## 2. 응답·요청에 필드가 없어 비워두거나 대체 중

| 필요한 것 | 현재 동작 | 위치 |
|---|---|---|
| 내 모임방 목록 | 목록 API 없음. 이 기기에 저장된 방만 표시하므로 기기를 바꾸면 사라짐 | `src/lib/session.ts` |
| 방 목록 대표 사진 | 응답에 없어 빈 칸 | `src/pages/RoomListPage.tsx` |
| 방 목록 답가 수 | 응답에 없어 안 읽은 알림 수로 대체 | `src/pages/RoomListPage.tsx` |
| 초대한 사람 이름 | `InvitePreview` 응답에 없음 | `src/pages/InviteJoinPage.tsx` |
| 방 만들 때 인원 `capacity` | 요청에 보내고 있으나 백엔드 반영 여부 미확인 | `src/api/types.ts` |
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
2. 방 만들기 `capacity` 반영, 홈 응답에 방별 정원
3. 돌려보기, 엮기, 두루마리, 반응, 덧붙임 API
4. 방 나가기와 설정 관련 API
5. 응답 필드 추가: 초대한 사람 이름, 대표 사진, 답가 수
