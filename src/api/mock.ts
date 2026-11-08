// 백엔드가 준비되기 전, 개발 서버에서 화면을 확인하기 위한 예시 데이터
// .env.local 에 VITE_USE_MOCK=false 를 넣으면 실제 API를 호출한다
import type {
  Askback,
  CloseRoomResult,
  CreateRoomRequest,
  CreateRoomResult,
  InvitePreview,
  JoinRoomResult,
  Member,
  RoomHome,
  RoomNotification,
  TranscriptionDraft,
} from './types'
import { MEMORY_PHOTOS } from '../features/memories/data'

export const USE_MOCK = import.meta.env.DEV && import.meta.env.VITE_USE_MOCK === 'true'

let mockReweavesUsed = 0
export function consumeMockReweave() { mockReweavesUsed++ }
export function withMockQuota(home: RoomHome): RoomHome {
  const quota = home.room.quota
  if (!quota) return home
  return { ...home, room: { ...home.room, quota: {
    ...quota,
    regenerationCount: (quota.regenerationCount ?? 0) + mockReweavesUsed,
    regenerationsRemaining: quota.regenerationsRemaining === undefined ? undefined : Math.max(0, quota.regenerationsRemaining - mockReweavesUsed),
  } } }
}

/** 두루마리 기능 검증 전용 방. 기존 데모 방의 플랜·한도는 유지한다. */
export const MOCK_SCROLL_PREVIEW_ROOM_ID = 'scroll-review'

export const MOCK_ROOM_ID = 'demo'
/** 방 만들기로 막 연 방. 친구를 기다리는 화면을 확인할 때 쓴다 */
export const MOCK_NEW_ROOM_ID = 'gathering'
/** 두루마리가 완성된 방. 방 목록의 완성된 두루마리를 확인할 때 쓴다 */
export const MOCK_DONE_ROOM_ID = 'grown'
/** 모두 다 봐서 엮을 수 있는 방 ('엮으러 가기' 시안 화면) */
export const MOCK_READY_ROOM_ID = 'done'
/** 약속한 시간이 다 됐는데 아직 엮지 않은 방 */
export const MOCK_TIMEUP_ROOM_ID = 'timeup'
/** 플랜 한도를 모두 쓴 방 */
export const MOCK_LIMIT_ROOM_ID = 'limit'
/** 사진 한도 없이 계속 올려 볼 수 있는 방 (사진 올리기·장소 고르기 화면 확인용) */
export const MOCK_UNLIMITED_ROOM_ID = 'unlimited'
/** 8명이 이야기를 많이 나눈 방 (핀 꽃이 가득한 화면 확인용) */
export const MOCK_LIVELY_ROOM_ID = 'lively'
export const MOCK_ROOM_IDS = [
  MOCK_LIVELY_ROOM_ID,
  MOCK_UNLIMITED_ROOM_ID,
  MOCK_ROOM_ID,
  MOCK_READY_ROOM_ID,
  MOCK_TIMEUP_ROOM_ID,
  MOCK_LIMIT_ROOM_ID,
  MOCK_NEW_ROOM_ID,
  MOCK_DONE_ROOM_ID,
]
export const MOCK_INVITE_TOKEN = 'demo'

export const mockInvitePreview: InvitePreview = {
  roomId: MOCK_ROOM_ID,
  alreadyJoined: false,
  roomName: '경주 1박2일',
  meetingDate: '2026-10-17',
  status: 'COLLECTING',
  memberCount: 3,
  capacity: 8,
  flowers: ['AZALEA', 'FORGET_ME_NOT', 'FORSYTHIA'],
  canJoin: true,
}

export function mockCreateRoom({ name, meetingDate, hostNickname }: CreateRoomRequest): CreateRoomResult {
  return {
    room: {
      id: MOCK_NEW_ROOM_ID,
      name,
      meetingDate,
      status: 'COLLECTING',
      deadlineAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
    },
    member: { id: 'mock-host', nickname: hostNickname, role: 'HOST', flowerCode: 'AZALEA' },
    inviteToken: MOCK_INVITE_TOKEN,
  }
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
  }
}

// 데모 방 둘러보기에 나오는 사진 (api/memories.ts의 mockPhotoCards와 같은 2장).
// 멤버의 사진·이야기 수를 이 사진들에서 세어서, 꽃 숫자와 꽃 모달·참여현황이 서로 맞게 한다
export const DEMO_CIRCULATION_PHOTOS = MEMORY_PHOTOS.slice(0, 2)

function demoCounts(nickname: string) {
  const photoCount = DEMO_CIRCULATION_PHOTOS.filter((p) => p.owner === nickname).length
  const storyCount = DEMO_CIRCULATION_PHOTOS.reduce(
    (n, p) => n + (p.firstStory.author === nickname ? 1 : 0) + p.friends.filter((f) => f.author === nickname).length,
    0,
  )
  return { photoCount, storyCount }
}

const mockMembers: RoomHome['members'] = [
  { id: 'm1', nickname: '서연', role: 'HOST', flowerCode: 'AZALEA', ...demoCounts('서연'), responseRate: 1 },
  { id: 'm2', nickname: '민지', role: 'MEMBER', flowerCode: 'FORSYTHIA', ...demoCounts('민지'), responseRate: 0.55 },
  { id: 'm3', nickname: '지수', role: 'MEMBER', flowerCode: 'FORGET_ME_NOT', ...demoCounts('지수'), responseRate: 0.75 },
]

export const mockRoomHome: RoomHome = {
  room: {
    id: MOCK_ROOM_ID,
    name: mockInvitePreview.roomName,
    meetingDate: mockInvitePreview.meetingDate,
    status: 'CIRCULATING',
    capacity: 5,
    planType: 'FREE',
    // Free 플랜. 사진·녹음을 평소처럼 해 볼 수 있게 한도가 남아 있는 상태로 둔다
    quota: {
      photosPerMember: 3,
      myPhotoCount: 0,
      myPhotosRemaining: 3,
      firstMaxSeconds: 30,
      otherMaxSeconds: 20,
      voiceLimitMs: 15 * 60 * 1000,
      voiceUsedMs: 3 * 60 * 1000,
      voiceRemainingMs: 12 * 60 * 1000,
      regenerationLimit: 3,
      regenerationCount: 1,
      regenerationsRemaining: 2,
    },
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

/** 모두 다 봐서 방장이 엮을 수 있는 방 */
export const mockReadyRoomHome: RoomHome = {
  ...mockRoomHome,
  room: {
    ...mockRoomHome.room,
    id: MOCK_READY_ROOM_ID,
    // 지금부터 12시간 뒤
    deadlineAt: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
  },
  me: mockMembers[0],
  members: mockMembers.map((m) => ({ ...m, responseRate: 1 })),
  myTodo: { needsFirstEntry: false, pendingCirculationCount: 0, topAskback: null },
  allCompleted: true,
}

/** 약속한 시간이 지났는데 아직 엮지 않은 방 (방장 시점) */
export const mockTimeUpRoomHome: RoomHome = {
  ...mockRoomHome,
  room: {
    ...mockRoomHome.room,
    id: MOCK_TIMEUP_ROOM_ID,
    name: '제주 2박3일',
    // 1시간 전에 마감
    deadlineAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
  },
  me: mockMembers[0],
}

/** 사진·말하기·재엮기 한도를 모두 쓴 방 (멤버 시점). 한도 시트를 확인할 때 쓴다 */
export const mockLimitRoomHome: RoomHome = {
  ...mockRoomHome,
  room: {
    ...mockRoomHome.room,
    id: MOCK_LIMIT_ROOM_ID,
    name: '부산 당일치기',
    quota: {
      photosPerMember: 3,
      myPhotoCount: 3,
      myPhotosRemaining: 0,
      firstMaxSeconds: 30,
      otherMaxSeconds: 20,
      voiceLimitMs: 15 * 60 * 1000,
      voiceUsedMs: 15 * 60 * 1000,
      voiceRemainingMs: 0,
      regenerationLimit: 3,
      regenerationCount: 3,
      regenerationsRemaining: 0,
    },
  },
}

export function mockCloseRoom(): CloseRoomResult {
  return { roomStatus: 'WEAVING', job: { id: 'mock-job', type: 'WEAVE_SCROLL', status: 'QUEUED' } }
}

const mockHost: Member = { id: 'mock-host', nickname: '서연', role: 'HOST', flowerCode: 'AZALEA' }

/** 방장 혼자 있는 막 만든 방 */
export const mockNewRoomHome: RoomHome = {
  room: {
    id: MOCK_NEW_ROOM_ID,
    name: '가을 MT',
    meetingDate: '2026-11-01',
    status: 'COLLECTING',
    // 지금부터 47시간 뒤
    deadlineAt: new Date(Date.now() + 47 * 60 * 60 * 1000).toISOString(),
    planType: 'FREE',
    // 막 만든 Free 방이라 한도를 하나도 쓰지 않았다
    quota: {
      photosPerMember: 3,
      myPhotoCount: 0,
      myPhotosRemaining: 3,
      firstMaxSeconds: 30,
      otherMaxSeconds: 20,
      voiceLimitMs: 15 * 60 * 1000,
      voiceUsedMs: 0,
      voiceRemainingMs: 15 * 60 * 1000,
      regenerationLimit: 3,
      regenerationCount: 0,
      regenerationsRemaining: 3,
    },
  },
  me: mockHost,
  // 멤버로 데모할 때 볼 수 있게 친구 한 명이 먼저 들어와 있다
  members: [mockHost, { id: 'mock-member-1', nickname: '민지', role: 'MEMBER', flowerCode: 'FORSYTHIA' }],
  todayFlowers: [],
  myTodo: { needsFirstEntry: true, pendingCirculationCount: 0, topAskback: null },
  unreadCount: 0,
  allCompleted: false,
}

const mockDoneMembers: RoomHome['members'] = [
  { id: 'd1', nickname: '서연', role: 'HOST', flowerCode: 'AZALEA', photoCount: 3 },
  { id: 'd2', nickname: '민지', role: 'MEMBER', flowerCode: 'FORSYTHIA', photoCount: 2 },
  { id: 'd3', nickname: '지수', role: 'MEMBER', flowerCode: 'FORGET_ME_NOT', photoCount: 2 },
  { id: 'd4', nickname: '하린', role: 'MEMBER', flowerCode: 'LILAC', photoCount: 2 },
]

/** 두루마리가 완성되어 답가를 받는 방 */
export const mockDoneRoomHome: RoomHome = {
  room: {
    id: MOCK_DONE_ROOM_ID,
    name: '여름 부산 바다',
    meetingDate: '2026-08-14',
    status: 'GROWING',
    deadlineAt: '2026-08-16T00:00:00+09:00',
    planType: 'FREE',
    // 재엮기를 모두 써서 답가를 달면 한도 시트가 뜨는 상태
    quota: {
      regenerationLimit: 3,
      regenerationCount: 3,
      regenerationsRemaining: 0,
      firstMaxSeconds: 30,
      otherMaxSeconds: 20,
      voiceLimitMs: 15 * 60 * 1000,
      voiceUsedMs: 15 * 60 * 1000,
      voiceRemainingMs: 0,
    },
  },
  me: mockDoneMembers[0],
  members: mockDoneMembers,
  todayFlowers: [],
  myTodo: { needsFirstEntry: false, pendingCirculationCount: 0, topAskback: null },
  unreadCount: 2,
  allCompleted: true,
}

export const mockAskback: Askback = {
  id: 'a1',
  // 사진이 없으면 화면에서 자리표시를 보여준다
  photo: { id: 'mock-photo', imageUrl: '', uploader: mockMembers[0], displayOrder: 0 },
  gapType: 'CONFLICT',
  question: '민지님은 그때 어땠어요?',
  evidenceNicknames: ['서연', '지수'],
  status: 'PENDING',
  firstEntry: null,
  createdAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
}

/** 받아 적기 흉내. 1.2초 뒤 정해진 글을 돌려준다 */
export function mockTranscribe(transcript: string) {
  return new Promise<TranscriptionDraft>((resolve) =>
    setTimeout(
      () =>
        resolve({
          transcriptionId: 'mock-transcription',
          audioAssetId: 'mock-audio',
          transcript,
          expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
        }),
      1200,
    ),
  )
}

const minutesAgo = (m: number) => new Date(Date.now() - m * 60 * 1000).toISOString()

export const mockNotifications: RoomNotification[] = [
  { id: 'n0', type: 'PLAN_UPGRADE_REQUESTED', resourceType: 'PHOTO', resourceId: 'm2', readAt: null, createdAt: minutesAgo(2) },
  { id: 'n1', type: 'ASKBACK_RECEIVED', resourceType: 'ASKBACK', resourceId: 'a1', readAt: null, createdAt: minutesAgo(5) },
  { id: 'n2', type: 'REPLY_APPLIED', resourceType: 'SCROLL', resourceId: 's1', readAt: null, createdAt: minutesAgo(180) },
  { id: 'n3', type: 'SCROLL_READY', resourceType: 'SCROLL', resourceId: 's1', readAt: minutesAgo(1440), createdAt: minutesAgo(1500) },
]

// 데모 로그인에서 고른 역할 (방장으로 보기 / 멤버로 보기). lib/auth가 로그인할 때 저장한다
export type MockRole = 'HOST' | 'MEMBER'
export const MOCK_AUTH_KEY = 'duruduru:auth'

export function getMockRole(): MockRole {
  try {
    const raw = localStorage.getItem(MOCK_AUTH_KEY)
    return raw && (JSON.parse(raw) as { role?: MockRole }).role === 'MEMBER' ? 'MEMBER' : 'HOST'
  } catch {
    return 'HOST'
  }
}

/** 데모에서 고른 역할에 맞춰 이 방의 '나'를 방장 또는 멤버로 바꿔 돌려준다 */
export function asMockRole(home: RoomHome): RoomHome {
  const role = getMockRole()
  if (home.me.role === role) return home
  const me = home.members.find((m) => m.role === role)
  return me ? { ...home, me } : home
}

// 데모에서 이 기기로 올린 사진·남긴 한마디를 기억해 두고 모임방 홈에 반영한다 (꽃이 피고 할 일이 바뀌게)
const MOCK_ACTIVITY_KEY = 'duruduru:mock-activity'

interface MockActivity {
  /** 방별로 올린 사진 수와 남긴 한마디 수 */
  rooms: Record<string, { photos: number; entries: number }>
  /** mock 사진 id가 어느 방 사진인지 */
  photoRoom: Record<string, string>
}

function readMockActivity(): MockActivity {
  try {
    const raw = sessionStorage.getItem(MOCK_ACTIVITY_KEY)
    if (raw) return JSON.parse(raw) as MockActivity
  } catch {
    // 저장소를 쓸 수 없으면 기록 없이 보여준다
  }
  return { rooms: {}, photoRoom: {} }
}

function writeMockActivity(activity: MockActivity) {
  try {
    sessionStorage.setItem(MOCK_ACTIVITY_KEY, JSON.stringify(activity))
  } catch {
    // 무시
  }
}

export function recordMockPhotos(roomId: string, photoIds: string[]) {
  const activity = readMockActivity()
  const room = activity.rooms[roomId] ?? { photos: 0, entries: 0 }
  activity.rooms[roomId] = { ...room, photos: room.photos + photoIds.length }
  photoIds.forEach((id) => (activity.photoRoom[id] = roomId))
  writeMockActivity(activity)
}

/** 첫 한마디를 남긴 사진. 그 사진이 올라간 방에 꽃이 하나 핀다 */
export function recordMockEntry(photoId: string) {
  const activity = readMockActivity()
  const roomId = activity.photoRoom[photoId]
  if (!roomId) return
  const room = activity.rooms[roomId] ?? { photos: 0, entries: 0 }
  activity.rooms[roomId] = { ...room, entries: room.entries + 1 }
  writeMockActivity(activity)
}

/** 이 기기에서 남긴 사진·한마디만큼 내 사진 수, 오늘 핀 꽃, 내 할 일, 한도를 바꿔 돌려준다 */
export function withMockActivity(home: RoomHome): RoomHome {
  const done = readMockActivity().rooms[home.room.id]
  if (!done) return home
  const me = {
    ...home.me,
    photoCount: (home.me.photoCount ?? 0) + done.photos,
    storyCount: (home.me.storyCount ?? 0) + done.entries,
  }
  const quota = home.room.quota
  return {
    ...home,
    room: quota
      ? {
          ...home.room,
          quota: {
            ...quota,
            myPhotoCount: (quota.myPhotoCount ?? 0) + done.photos,
            myPhotosRemaining: Math.max((quota.myPhotosRemaining ?? 0) - done.photos, 0),
          },
        }
      : home.room,
    me,
    members: home.members.map((m) => (m.id === me.id ? me : m)),
    todayFlowers: [
      ...home.todayFlowers,
      ...Array.from({ length: done.entries }, () => ({ memberId: me.id, flowerCode: me.flowerCode, entryKind: 'FIRST' as const })),
    ],
    myTodo: { ...home.myTodo, needsFirstEntry: home.myTodo.needsFirstEntry && done.entries === 0 },
  }
}

/** 사진 무한: 한도가 사실상 없어서 사진 올리기 화면을 몇 번이고 볼 수 있다 */
export const mockUnlimitedRoomHome: RoomHome = {
  ...mockRoomHome,
  room: {
    ...mockRoomHome.room,
    id: MOCK_UNLIMITED_ROOM_ID,
    name: '사진 무한',
    quota: {
      ...mockLimitRoomHome.room.quota!,
      photosPerMember: 999,
      myPhotoCount: 0,
      myPhotosRemaining: 999,
      voiceUsedMs: 0,
      voiceRemainingMs: 15 * 60 * 1000,
      regenerationCount: 0,
      regenerationsRemaining: 3,
    },
  },
  // 홈의 내 할 일이 늘 "사진 올리고 한마디 남기기"로 보이게 한다
  myTodo: { ...mockRoomHome.myTodo, needsFirstEntry: true },
}

/** 이야기를 많이 나눈 방: 8명이 모두 사진을 올리고 서로 덧붙여서 핀 꽃이 가득하다 */
export const livelyMembers: RoomHome['members'] = [
  { id: 'l1', nickname: '서연', role: 'HOST', flowerCode: 'AZALEA', photoCount: 3, storyCount: 7, responseRate: 1 },
  { id: 'l2', nickname: '민지', role: 'MEMBER', flowerCode: 'FORSYTHIA', photoCount: 3, storyCount: 6, responseRate: 0.9 },
  { id: 'l3', nickname: '지수', role: 'MEMBER', flowerCode: 'ROYAL_AZALEA', photoCount: 2, storyCount: 5, responseRate: 0.85 },
  { id: 'l4', nickname: '하린', role: 'MEMBER', flowerCode: 'CANOLA', photoCount: 3, storyCount: 4, responseRate: 0.8 },
  { id: 'l5', nickname: '도윤', role: 'MEMBER', flowerCode: 'LILAC', photoCount: 2, storyCount: 4, responseRate: 0.7 },
  { id: 'l6', nickname: '예준', role: 'MEMBER', flowerCode: 'FORGET_ME_NOT', photoCount: 3, storyCount: 3, responseRate: 0.65 },
  { id: 'l7', nickname: '수아', role: 'MEMBER', flowerCode: 'TEAL', photoCount: 2, storyCount: 3, responseRate: 0.6 },
  { id: 'l8', nickname: '시우', role: 'MEMBER', flowerCode: 'PURPLE', photoCount: 1, storyCount: 2, responseRate: 0.5 },
]
const livelyPattern = [0, 1, 2, 0, 3, 4, 1, 5, 0, 2, 1, 3, 0, 4, 2, 5, 1, 3, 0] // 수아·시우는 아직 오늘 이야기가 없다 (봉오리)

export const mockLivelyRoomHome: RoomHome = {
  ...mockRoomHome,
  room: { ...mockRoomHome.room, id: MOCK_LIVELY_ROOM_ID, name: '제주 여름 MT', capacity: 8 },
  me: livelyMembers[1],
  members: livelyMembers,
  todayFlowers: livelyPattern.map((i, n) => ({
    memberId: livelyMembers[i].id,
    flowerCode: livelyMembers[i].flowerCode,
    entryKind: n < 8 ? ('FIRST' as const) : ('ADDON' as const),
  })),
}

/** 데모 '제주 여름 MT' 방의 둘러보기 사진: 사람마다 올린 사진 수만큼, 첫 한마디와 친구들 덧붙이기가 달려 있다 */
const LIVELY_FIRST = [
  '협재 바다 색이 진짜 이랬어, 보정 하나도 안 했음', '새벽에 일출 보러 성산 올라간 날', '흑돼지 줄 한 시간 섰는데 그럴 만했다',
  '숙소 마당에서 다 같이 별 본 밤', '우도 땅콩 아이스크림 두 개 먹은 사람 나야', '비 와서 카페 투어로 바꾼 날이 제일 웃겼어',
  '렌터카 길 잘못 들어서 발견한 귤밭', '오름 올라가다 바람에 모자 날아감', '마지막 날 공항 가기 전 해변 산책',
]
const LIVELY_ADDON = [
  '이때 너 신발 젖은 거 아직도 기억나', '나 이 사진 배경화면 했잖아', '다음엔 꼭 일출 성공하자', '여기 또 가고 싶다 진짜',
  '이날 노래 부른 거 영상 있음ㅋㅋ', '사진 찍어 준 사람 칭찬해', '이 순간 공기 냄새까지 생각나', '내가 운전했던 날!',
]
export function mockLivelyCards() {
  type M = (typeof livelyMembers)[number]
  const at = (min: number) => new Date(Date.now() - min * 60_000).toISOString()
  // 사람마다 참여현황 수와 똑같이: 사진 photoCount장(각각 첫 한마디), 나머지 이야기는 친구 사진에 덧붙이기
  const cards = livelyMembers.flatMap((owner, oi) =>
    Array.from({ length: owner.photoCount ?? 0 }, (_, k) => {
      const id = `lively-${owner.id}-${k}`
      return {
        photo: { id, imageUrl: `https://picsum.photos/seed/${id}/600/600`, uploader: owner, displayOrder: k },
        firstEntry: { id: `${id}-first`, photoId: id, member: owner, kind: 'FIRST' as const, inputMode: 'TEXT' as const, transcript: LIVELY_FIRST[(oi + k * 3) % LIVELY_FIRST.length], confirmedAt: at(oi * 90 + k * 40 + 30) },
        myResponse: { status: owner.id === livelyMembers[1].id ? 'OWN_PHOTO' as const : 'ADDON' as const },
        locked: false,
        lockReason: null,
        otherEntries: [] as { id: string; photoId: string; member: M; kind: 'ADDON'; inputMode: 'TEXT'; transcript: string; confirmedAt: string }[],
      }
    }),
  )
  livelyMembers.forEach((m, mi) => {
    const extra = (m.storyCount ?? 0) - (m.photoCount ?? 0)
    const targets = cards.filter((c) => c.photo.uploader.id !== m.id)
    for (let j = 0; j < extra; j += 1) {
      const card = targets[(mi * 5 + j * 3) % targets.length]
      card.otherEntries.push({ id: `${card.photo.id}-add-${m.id}-${j}`, photoId: card.photo.id, member: m, kind: 'ADDON', inputMode: 'TEXT', transcript: LIVELY_ADDON[(mi + j) % LIVELY_ADDON.length], confirmedAt: at(mi * 13 + j * 7) })
    }
  })
  return cards
}
