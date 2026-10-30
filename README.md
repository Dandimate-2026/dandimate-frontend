# 단디메이트 프론트엔드

React, TypeScript, Vite, Tailwind CSS를 사용하는 모바일 웹앱입니다.

## 개발

```sh
npm ci
npm run dev
```

```sh
npm run lint
npm run build
npm run preview
```

전역 화면 레이아웃은 `src/layout/globallayout.jsx`에서 관리합니다. 작업 영역은 최대 430px의 흰색 화면이며, 바깥 배경은 `#f3f3f3`입니다. Pretendard 가변 폰트를 사용합니다.

## PWA

`vite-plugin-pwa`가 빌드 시 `manifest.webmanifest`, `sw.js`, 서비스 워커 등록 스크립트를 생성합니다. `dist/` 전체를 배포해야 합니다.

- 앱 이름: 단디메이트
- 실행 모드: `standalone`
- 설정 파일: `vite.config.ts`
- 개발 서버에서는 서비스 워커를 등록하지 않습니다. PWA 확인은 `npm run build` 후 `npm run preview`로 진행합니다.
- 배포 환경에서는 HTTPS가 필요하며, 로컬에서는 `localhost` 또는 `127.0.0.1`로 확인할 수 있습니다.
- 설치 메뉴를 지원하는 브라우저에서 앱 설치 또는 홈 화면에 추가를 선택합니다. iOS에서는 공유 메뉴의 홈 화면에 추가를 사용합니다.

### 캐시와 업데이트

한 번 온라인으로 방문한 뒤 앱 화면과 정적 리소스를 오프라인에서 열 수 있습니다. Pretendard는 실제 사용한 글자 범위만 캐시합니다. API 응답은 캐시하지 않으므로 이후 추가할 서버 기능에는 별도의 오프라인 처리가 필요합니다.

새 서비스 워커가 설치되어 대기 중이어도 현재 화면을 강제로 새로고침하지 않습니다. 이 앱을 사용하는 모든 탭과 설치된 앱 창을 닫은 뒤 다시 열면 대기 중인 버전이 활성화됩니다.

### 설치 아이콘

현재는 단디메이트의 D를 사용한 기본 아이콘을 제공합니다. `public/favicon.svg`를 수정하고 다음 명령을 실행하면 일반 아이콘(192/512px), 마스크형 아이콘(512px), Apple Touch 아이콘(180px)을 다시 생성합니다.

```sh
npm run generate:pwa-assets
```

생성 규칙은 `pwa-assets.config.ts`에 있습니다. 생성한 PNG 파일도 함께 커밋합니다.

참고: [Vite PWA 등록 방식](https://vite-pwa-org.netlify.app/guide/register-service-worker), [MDN PWA 설치 조건](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable)
