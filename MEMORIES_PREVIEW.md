# 두루두루 기억 화면 미리보기

첨부한 SVG 8개를 기준으로 만든 React UI입니다. 기존 앱 파일과 라우트를 수정하지 않고 별도 진입점을 추가했습니다.

## 실행

기존 개발 서버를 사용합니다.

```sh
npm run dev
```

서버가 5173 포트에서 실행 중이면 `http://localhost:5173/memories.html`에서 화면 목록을 볼 수 있습니다. localhost 주소는 서버가 실행되는 PC에서 사용하는 주소입니다.

| 화면 | 주소의 마지막 부분 |
| --- | --- |
| 내 기억을 남기기 전 | `memories.html#s6-1` |
| 덧붙이기 시트 | `memories.html#s6-2` |
| 친구 이야기와 내 덧붙임 | `memories.html#s6-3` |
| 패스한 사진 | `memories.html#s6-4` |
| 돌려보기 완료 | `memories.html#s6-5` |
| 이야기 엮는 중 | `memories.html#s8` |
| 두루마리 | `memories.html#s9` |
| 답가 쓰기 시트 | `memories.html#s10` |

독립 빌드는 다음 명령으로 생성합니다. 기존 `npm run build`에는 새 진입점을 연결하지 않았습니다.

```sh
npx vite build --config vite.memories.config.ts
npx vite preview --config vite.memories.config.ts
```

빌드 출력은 `dist-memories`입니다. 미리보기 서버에서도 `/memories.html`로 접근합니다.

## 구성과 재사용

- `src/features/memories/components.tsx`: 헤더, 카드, 꽃, 사진 영역, 이야기 카드, 바텀 시트, 공유 버튼.
- `ContributionSheet.tsx`: 덧붙임과 답가가 공유하는 글·음성 입력 UI.
- `CirculationPage.tsx`: 잠금·열람·패스 상태를 한 컴포넌트로 처리.
- `CompletionPages.tsx`: 완료 통계와 엮기 대기 화면.
- `ScrollPage.tsx`: 두루마리, 반응, 답가, 원문, 평점, 사진·이야기 추가.
- `MemoryPreview.tsx`: 화면 목록과 미리보기 상태 관리.
- 기존 `Button`, `Card`, 아이콘, 녹음 컨트롤, `useVoiceRecorder`, 색상 토큰, Pretendard를 재사용.
- `src/assets/memories`: 제공된 SVG에서 추출한 꽃·잠금·패스·두루마리 도형.

## 동작 범위

입력·수정·패스·답가·반응·평점·사진 추가는 현재 화면의 React 상태로 동작합니다. 새로고침하거나 목록에서 다른 시작 화면을 선택하면 초기화됩니다. 서버 저장, 실제 AI 생성, 알림 발송은 연결하지 않았습니다. S8은 미리보기용 30초 타이머 이후 S9로 이동합니다. 완료 화면의 31시간은 시안의 예시 값입니다.

사진은 시안과 같은 빈 사진 영역으로 표시합니다. `PhotoSlot`의 `src`와 `MemoryPhoto.photoUrl`로 실제 사진을 연결할 수 있습니다. 예시 이야기의 원본 음성이 없어 재생 버튼은 지원 브라우저에서 한국어 글 읽기를 사용하며, 해당 사실을 화면에 표시합니다. 직접 녹음한 음성은 미리 듣기와 저장이 가능합니다. 음성 인식은 포함하지 않습니다.

공유는 Web Share API 또는 문구 복사를 사용합니다. 공개 페이지 주소가 없으므로 localhost 링크는 공유하지 않습니다.

## 검증

타입 검사, 변경 범위 ESLint(경고 0), 별도 프로덕션 빌드, 주요 브라우저 클릭 흐름을 확인했습니다. 원본 대비 스크린샷과 세부 결과는 [design-qa.md](design-qa.md)에 있습니다. 실제 마이크 녹음·운영체제 공유·실제 파일 선택은 이번 자동 검증에서 실행하지 않았습니다.
