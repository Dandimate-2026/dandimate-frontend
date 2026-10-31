// 백엔드가 준비되기 전, 개발 서버에서 화면을 확인하기 위한 예시 데이터
// .env.local 에 VITE_USE_MOCK=false 를 넣으면 실제 API를 호출한다
import type { InvitePreview, JoinRoomResult, RoomHome } from './types'

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

const mockMembers: RoomHome['members'] = [
  { id: 'm1', nickname: '서연', role: 'HOST', flowerCode: 'AZALEA', photoCount: 2, storyCount: 3, responseRate: 1 },
  { id: 'm2', nickname: '민지', role: 'MEMBER', flowerCode: 'FORSYTHIA', photoCount: 2, storyCount: 1, responseRate: 0.55 },
  { id: 'm3', nickname: '지수', role: 'MEMBER', flowerCode: 'FORGET_ME_NOT', photoCount: 2, storyCount: 2, responseRate: 0.75 },
]

export const mockRoomHome: RoomHome = {
  room: {
    id: MOCK_ROOM_ID,
    name: mockInvitePreview.roomName,
    meetingDate: mockInvitePreview.meetingDate,
    status: 'CIRCULATING',
    // 지금부터 31시간 뒤
    deadlineAt: new Date(Date.now() + 31 * 60 * 60 * 1000).toISOString(),
  },
  me: mockMembers[1],
  members: mockMembers,
  todayFlowers: [
    { memberId: 'm1', flowerCode: 'AZALEA', entryKind: 'FIRST' },
    { memberId: 'm1', flowerCode: 'AZALEA', entryKind: 'ADDON' },
    { memberId: 'm2', flowerCode: 'FORSYTHIA', entryKind: 'FIRST' },
    { memberId: 'm3', flowerCode: 'FORGET_ME_NOT', entryKind: 'FIRST' },
    { memberId: 'm3', flowerCode: 'FORGET_ME_NOT', entryKind: 'ADDON' },
    { memberId: 'm1', flowerCode: 'AZALEA', entryKind: 'ADDON' },
  ],
  myTodo: {
    needsFirstEntry: false,
    pendingCirculationCount: 3,
    topAskback: { id: 'a1', question: '민지님은 그때 어땠어요?' },
  },
  unreadCount: 0,
  allCompleted: false,
}
