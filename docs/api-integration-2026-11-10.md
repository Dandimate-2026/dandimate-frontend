# 추가 API 연동 및 지도 개선 — 2026-11-10

## 최종 UI 및 develop 통합 확인

- 초대 링크 참여는 목록의 버튼과 모달로 제공한다. 방 생성 화면에서도 목록의 모달로 연결한다.
- 사진 한도에 도달해도 선택 화면 진입을 유지한다. 내 사진에만 장소 추가·변경과 삭제를 제공하고 공유·삭제는 더 보기 메뉴에 모은다.
- 템플릿 미리보기는 플랜 화면에서 기본 접힘으로 제공한다. 기존 방은 현재 플랜을 선택하고 새 방은 직접 선택한다. 선택 플랜과 이용 중 플랜을 구분해 사용 가능 안내를 갱신한다.
- 두루마리는 기존 전체 펼치기 화면을 유지한다. 문단 바로가기와 한 문단 읽기는 제거했다. 공감·재엮기는 한 줄에 배치하고 재엮기는 횟수 안내 후 확인한다.
- `origin/feature/develop`의 `0771739`를 병합했다. 플랜 상세·가격 확인, 실제 인원 기준 금액, PRO 한도, 템플릿 복귀 상태와 README 변경을 유지했다.
- 병합 후 Node 테스트 69개, 소스·테스트 ESLint, TypeScript·프로덕션/PWA 빌드 통과. 기존 번들 크기 경고는 남는다.
- 병합 후 모의 API Chromium 검사: 현재 플랜 선택과 Lite/Pro 반복 전환, 미리보기 기본 접힘, 초대 모달 입력·닫기·잘못된 링크·정상 이동, 320~768px 둘러보기 배치를 확인했다. 스크립트와 결과는 `artifacts/plan-template-concise-*`, `artifacts/invite-modal-*`, `artifacts/feed-layout-*`에 있다.

## 최신 명세 확인

- API: https://43-201-73-60.sslip.io/api/v1
- Swagger: https://43-201-73-60.sslip.io/swagger-ui.html
- Swagger가 로드하는 `/openapi/public-api.yaml`을 캐시 갱신 query로 다운로드했다. 사본: `artifacts/api-update-current.yaml`, Swagger 사본: `artifacts/api-update-swagger.html`.
- 11월 9일 사본 `artifacts/api-recheck-public.yaml`과 비교해 아래 계약 추가 및 `servers.url`의 실제 Base URL 수정을 확인했다.

## 반영한 연동

| 기능 | 최신 계약 | 프론트 반영 |
| --- | --- | --- |
| 알림 삭제 | DELETE /notifications/{notificationId}, 204 | 전체/방별 알림을 왼쪽으로 살짝 밀어 휴지통을 표시하고 누르면 확인창 없이 서버 삭제. 성공 시 목록 제거. 404는 이미 사라진 알림으로 처리. 실패 시 알림을 유지하고 재시도. 기존 기기별 숨김 값은 더 이상 목록을 가리지 않음. |
| 공통 템플릿 | PATCH /rooms/{roomId}, RoomSummary.scrollTemplateId | 화면의 minimal을 CLASSIC, 지역/계절 id를 대문자 enum으로 변환. 조회는 기존 fromServerTemplate 변환 사용. 방장/플랜 권한 유지. 기존 SSE 구독에 scroll.template.updated가 포함되어 재조회. |
| 사진 처리 완료 | POST /photos/{photoId}/complete, photo.id/status/displayOrder | PROCESSING/UPLOADING 동안 재조회. READY만 완료로 인정하고 FAILED/응답 상태 누락은 성공으로 간주하지 않음. 반복 complete의 안전성이 명세에 반영됨. |
| 푸시 설정 | GET /push/vapid-public-key → enabled/publicKey | enabled=false이면 새 구독/기존 구독 재등록을 차단하고 안내. enabled=true일 때 공개키로 등록. |
| 푸시 구독 | POST/DELETE /push/subscriptions | 브라우저 구독 endpoint/keys를 등록하고 endpoint로 해제. 서버 해제 실패를 성공으로 숨기지 않음. |
| 동의 버전 | GET /consents/current → version/consented/consentedAt | 방 생성/입장/결제에 현재 version 사용. 조회 실패 시 임의의 v1로 진행하지 않음. |
| 생성 시 예약 | CreateRoomRequest.deadlineAt, 유료 방 주문의 room 입력 | 무료 방 생성과 유료 방 주문에 deadlineAt 동시 전달. 생성/결제 후 별도 PATCH 제거. 결제 복귀 시 다른 초안 날짜로 예약을 덮어쓰지 않음. |
| 장소 검색 범위 | GET /places/search | 최신 명세는 대구·경북 결과만 반환한다고 명시. 기존 검색 연동은 그대로 사용. |

알림을 읽거나 실제 삭제한 뒤 다른 화면으로 이동하면 목록/방 홈을 다시 조회해 서버의 unreadCount를 사용한다. 새로 연결한 계정 전체 SSE는 없으며 전체 알림은 진입/복귀/수동 새로고침으로 갱신한다.

## 지도 구조

- 그림은 도시 선택용이며 사진 실제 좌표를 근사 투영하거나 확대하지 않는다. 도시마다 일정한 그림 위치와 별도 도시 선택 버튼을 사용한다.
- 도시 요약에서 해당 도시의 서버 좌표로 실제 지도를 연다. 개별 사진의 장소 버튼은 해당 장소의 위도/경도를 그대로 사용하고 더 가까운 배율로 연다.
- 주변 기록으로 중심을 자동 보정하지 않는다. 실제 지도에서는 드래그 중심을 임의로 제한하거나 축소 시 그림으로 자동 전환하지 않는다. 명시적 돌아가기 버튼을 제공한다.
- 같은 상호의 다른 지점은 이름만으로 묶지 않는다. placeGroupKey/카카오 placeId가 있으면 이를 사용하고, 없을 때 이름과 좌표가 가까운 경우만 묶는다.

## 검증 및 남은 확인

- 프로덕션/PWA 빌드, TypeScript, src ESLint, git diff 공백 검사와 모의 API 기반 Chromium 320×568의 7개 시나리오 검증. 기존 번들 크기 경고는 남아 있다.
- 스크립트 `artifacts/api-update-browser.cjs`, 결과 `artifacts/api-update-results.json`.
- 무료/유료 payload와 동의 버전, 동의 실패 시 생성 차단, 템플릿 enum, 알림 삭제 500/204, 푸시 비활성/등록/해제, 사진 PROCESSING→READY 및 상태 누락, 지도 도시/장소 좌표·배율, 축소 후 지도 유지, 동일 상호 분리를 검증했다.
- 지도 SDK와 브라우저 푸시는 테스트 대역으로 검증했다. 실제 카카오 지도 SDK·iPhone/PWA·OS 푸시 도착은 실기기 확인이 필요하다.
- 배포 서버에 로그인한 사용자의 알림 실제 삭제, 결제 승인, 사진 업로드 등 쓰기 작업을 실행한 검증은 아니다. 공개 명세 변경 확인과 모의 연동 검증을 구분한다.
- 다른 기기 초안 이어쓰기, 멤버별 템플릿 안내 이력, 질문 크레딧 상품 목록, 모임 종료일은 이번 명세에 추가되지 않았다.

## 알림 삭제 UI 후속 반영

- 개별 알림의 하단 삭제 링크와 확인 모달을 제거했다. 왼쪽 스와이프는 휴지통 아이콘만 드러내며, 버튼을 눌러야 삭제 API를 호출한다.
- 삭제 중 중복 동작을 막고 처리 상태를 안내한다. 실패 시 알림을 유지하고 해당 행에 다시 삭제 버튼을 제공한다. 방 삭제의 확인 모달은 유지한다.
- TypeScript·변경 소스 ESLint·공백 검사와 `artifacts/notification-swipe-browser.cjs`로 전체/방별 알림의 터치/키보드 동작 및 서버 실패·재시도를 검증한다. 결과: `artifacts/notification-swipe-results.json`.

## 사진 한도 진입·내 사진 장소 보완

- COLLECTING/CIRCULATING 홈은 사진 한도를 다 채워도 사진 추가하기 진입을 유지한다. 선택 화면은 남은 한도가 0이면 파일 추가를 막고 잠긴 칸→기존 한도 시트를 제공한다. 사용량은 0/0 대신 누적 업로드/개인 한도로 표시한다.
- 개별 사진 진입에도 장소 추가/변경 콜백을 연결했다. 본인 여부는 OWN_PHOTO 응답과 업로더 멤버 id를 함께 확인하며 내가 올렸어요로 표시한다.
- 장소 수정은 본인 사진에 한해 제공하고 WEAVING 중에는 차단한다. GROWING에서 장소 수정을 허용하는 공개 API 계약은 유지하며 사진·원문 삭제/수정 잠금과 구분한다.
- TypeScript·변경 소스 ESLint·공백 검사 및 Chromium 320×568 모의 API 검증 통과. `artifacts/photo-access-browser.cjs`, `artifacts/photo-access-results.json`에 한도 진입, 장소 저장/새로고침, 본인·친구·엮는 중 권한 시나리오를 기록했다.
## 둘러보기 하단 동작 보완

- 방 상태를 확인하는 동안에는 확인 중 버튼을, 조회 실패 시에는 안내와 재시도 버튼을 표시한다. 상태 조회 실패 때문에 덧붙이기가 설명 없이 사라지지 않도록 했다.
- COLLECTING/CIRCULATING에서는 덧붙이기를 제공하고, WEAVING/GROWING에서는 마감 사유를 안내한다. 실시간 갱신 시 방 상태도 다시 확인한다.
- 돌아가기 버튼만 남으면 하단 전체 폭을 사용한다. 직접 링크로 진입해 이전 화면이 없을 때에는 방 홈으로 돌아간다.
- TypeScript와 변경 파일 ESLint 통과. `artifacts/circulation-action-browser.cjs`에서 조회 지연, 조회 실패 후 재시도, 덧붙이기 진입, 마감 상태의 단일 버튼 폭을 검증했다.

