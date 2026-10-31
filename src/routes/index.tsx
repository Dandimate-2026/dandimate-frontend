import { Navigate, Route, Routes } from 'react-router'
import { MOCK_INVITE_TOKEN, USE_MOCK } from '../api/mock'
import FirstEntryPage from '../pages/FirstEntryPage'
import InviteJoinPage from '../pages/InviteJoinPage'
import NotFoundPage from '../pages/NotFoundPage'
import PhotoUploadPage from '../pages/PhotoUploadPage'
import RoomHomePage from '../pages/RoomHomePage'
import RoomSharePage from '../pages/RoomSharePage'
import { paths } from './paths'

function AppRoutes() {
  return (
    <Routes>
      {/* 모임방 홈 */}
      <Route path={paths.roomHome(':roomId')} element={<RoomHomePage />} />
      {/* 방 생성 직후: 초대 링크 공유 */}
      <Route path={paths.roomShare(':roomId')} element={<RoomSharePage />} />
      {/* 이야기를 남길 사진 고르기 */}
      <Route path={paths.photoUpload(':roomId')} element={<PhotoUploadPage />} />
      {/* 고른 사진마다 첫 한마디 남기기 (음성 또는 글) */}
      <Route path={paths.firstEntry(':roomId')} element={<FirstEntryPage />} />
      {/* 초대 링크로 들어온 친구: 이름 입력 후 입장 */}
      <Route path={paths.inviteJoin(':inviteToken')} element={<InviteJoinPage />} />
      {/* TODO: 홈(방 만들기) 화면이 생기면 교체 */}
      {USE_MOCK && <Route path="/" element={<Navigate to={paths.inviteJoin(MOCK_INVITE_TOKEN)} replace />} />}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}

export default AppRoutes
