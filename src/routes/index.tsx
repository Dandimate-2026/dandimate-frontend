import { Route, Routes } from 'react-router'
import AskbackPage from '../pages/AskbackPage'
import FirstEntryPage from '../pages/FirstEntryPage'
import InviteJoinPage from '../pages/InviteJoinPage'
import LoginPage from '../pages/LoginPage'
import NotFoundPage from '../pages/NotFoundPage'
import PhotoUploadPage from '../pages/PhotoUploadPage'
import PolicyPage from '../pages/PolicyPage'
import RoomCheckoutPage from '../pages/RoomCheckoutPage'
import RoomCirculationPage from '../pages/RoomCirculationPage'
import RoomCreatePage from '../pages/RoomCreatePage'
import RoomHomePage from '../pages/RoomHomePage'
import RoomListPage from '../pages/RoomListPage'
import RoomPlanDonePage from '../pages/RoomPlanDonePage'
import RoomPlanPage from '../pages/RoomPlanPage'
import RoomNotificationsPage from '../pages/RoomNotificationsPage'
import RoomSettingsPage from '../pages/RoomSettingsPage'
import RoomSharePage from '../pages/RoomSharePage'
import RoomWeavingPage from '../pages/RoomWeavingPage'
import { paths } from './paths'
import RequireLogin from './RequireLogin'

function AppRoutes() {
  return (
    <Routes>
      {/* 첫 화면: 카카오로 시작하기 */}
      <Route path={paths.login()} element={<LoginPage />} />
      {/* 약관은 로그인 화면에서도 열 수 있어야 한다 */}
      <Route path={paths.terms()} element={<PolicyPage kind="terms" />} />
      <Route path={paths.privacy()} element={<PolicyPage kind="privacy" />} />
      {/* 아래 화면은 모두 로그인이 필요하다. 초대 링크로 들어온 친구도 로그인한 뒤 입장 화면으로 돌아온다 */}
      <Route element={<RequireLogin />}>
        {/* 내 모임방 목록 */}
        <Route path={paths.roomList()} element={<RoomListPage />} />
        {/* 모임방 만들기 */}
        <Route path={paths.roomCreate()} element={<RoomCreatePage />} />
        {/* 방 만들기 다음: 플랜을 고르고(유료면 결제) 그 플랜으로 방을 만든다 */}
        <Route path={paths.roomCreatePlan()} element={<RoomPlanPage />} />
        <Route path={paths.roomCreateCheckout()} element={<RoomCheckoutPage />} />
        {/* 모임방 홈 */}
        <Route path={paths.roomHome(':roomId')} element={<RoomHomePage />} />
        {/* 모임방 설정: 초대 링크, 함께하는 사람, 나가기 */}
        <Route path={paths.roomSettings(':roomId')} element={<RoomSettingsPage />} />
        {/* 모임방 알림: 받은 질문, 두루마리 완성, 답가 반영 */}
        <Route path={paths.roomNotifications(':roomId')} element={<RoomNotificationsPage />} />
        {/* 방 생성 직후: 플랜 선택 → (유료면) 결제 → 결제 완료 */}
        <Route path={paths.roomPlan(':roomId')} element={<RoomPlanPage />} />
        <Route path={paths.roomCheckout(':roomId')} element={<RoomCheckoutPage />} />
        <Route path={paths.roomPlanDone(':roomId')} element={<RoomPlanDonePage />} />
        {/* 플랜을 고른 뒤: 초대 링크 공유 */}
        <Route path={paths.roomShare(':roomId')} element={<RoomSharePage />} />
        {/* 이야기를 남길 사진 고르기 */}
        <Route path={paths.photoUpload(':roomId')} element={<PhotoUploadPage />} />
        {/* 고른 사진마다 첫 한마디 남기기 (음성 또는 글) */}
        <Route path={paths.firstEntry(':roomId')} element={<FirstEntryPage />} />
        {/* AI가 나에게만 묻는 질문에 답하기 */}
        <Route path={paths.askback(':roomId', ':askbackId')} element={<AskbackPage />} />
        {/* 친구 사진에 이야기 붙이기 */}
        <Route path={paths.roomCirculation(':roomId')} element={<RoomCirculationPage />} />
        {/* 엮으러 가기 다음: 엮는 중 → 두루마리 */}
        <Route path={paths.roomWeaving(':roomId')} element={<RoomWeavingPage />} />
        {/* 초대 링크로 들어온 친구: 이름 입력 후 입장 */}
        <Route path={paths.inviteJoin(':inviteToken')} element={<InviteJoinPage />} />
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}

export default AppRoutes
