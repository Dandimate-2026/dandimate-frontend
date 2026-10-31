// 백엔드가 준비되기 전, 개발 서버에서 화면을 확인하기 위한 예시 데이터
// .env.local 에 VITE_USE_MOCK=false 를 넣으면 실제 API를 호출한다
import type { InvitePreview, JoinRoomResult } from './types'

export const USE_MOCK = import.meta.env.DEV && import.meta.env.VITE_USE_MOCK !== 'false'

export const MOCK_ROOM_ID = 'demo'
export const MOCK_INVITE_TOKEN = 'demo'

export const mockInvitePreview: InvitePreview = {
  roomName: '경주 1박2일',
  meetingDate: '2026-10-17',
  status: 'COLLECTING',
  memberCount: 3,
  capacity: 8,
  flowers: ['AZALEA', 'FORGET_ME_NOT', 'FORSYTHIA'],
  canJoin: true,
}

export function mockJoinRoom(nickname: string): JoinRoomResult {
  return {
    room: {
      id: MOCK_ROOM_ID,
      name: mockInvitePreview.roomName,
      meetingDate: mockInvitePreview.meetingDate,
      status: 'COLLECTING',
      deadlineAt: '2026-10-19T00:00:00+09:00',
    },
    member: { id: 'mock-member', nickname, role: 'MEMBER', flowerCode: 'LILAC' },
    memberAccessToken: 'mock-token',
  }
}
