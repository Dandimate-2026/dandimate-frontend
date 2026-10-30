import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { MOCK_INVITE_TOKEN, USE_MOCK } from './api/mock'
import InviteJoinPage from './pages/InviteJoinPage'
import NotFoundPage from './pages/NotFoundPage'
import RoomSharePage from './pages/RoomSharePage'

function App() {
  return (
    <BrowserRouter>
      {/* 모바일 화면 폭(360px) 기준 레이아웃 */}
      <div className="mx-auto flex min-h-dvh max-w-[360px] flex-col">
        <Routes>
          {/* 방 생성 직후: 초대 링크 공유 */}
          <Route path="/rooms/:roomId/share" element={<RoomSharePage />} />
          {/* 초대 링크로 들어온 친구: 이름 입력 후 입장 */}
          <Route path="/invite/:inviteToken" element={<InviteJoinPage />} />
          {/* TODO: 홈(방 만들기) 화면이 생기면 교체 */}
          {USE_MOCK && <Route path="/" element={<Navigate to={`/invite/${MOCK_INVITE_TOKEN}`} replace />} />}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}

export default App
