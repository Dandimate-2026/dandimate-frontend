import { Navigate } from 'react-router'
import { paths } from '../routes/paths'

/** 기존 데모 링크도 계정 상태를 조회하는 모임방 목록으로 연결한다. */
export default function ReviewerDemoPage() {
  return <Navigate to={paths.roomList()} replace />
}
