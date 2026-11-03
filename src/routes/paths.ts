// 화면 경로를 한곳에서 관리한다. 페이지에서는 문자열 대신 이 함수를 쓴다.

export const paths = {
  /** redirect: 로그인한 뒤 돌아갈 주소 */
  login: (redirect?: string) => (redirect ? `/login?redirect=${encodeURIComponent(redirect)}` : '/login'),
  // 이 기기에 저장된 방이 없으면 방 만들기로 보낸다
  roomList: () => '/',
  roomCreate: () => '/rooms/new',
  roomHome: (roomId: string) => `/rooms/${roomId}`,
  // 방 만들기 → 플랜 선택 → (유료면) 결제 → 결제 완료 → 초대 링크 공유
  roomPlan: (roomId: string) => `/rooms/${roomId}/plan`,
  // 고른 플랜은 ?plan= 으로 넘긴다. 라우트를 정의할 때는 plan 없이 부른다
  roomCheckout: (roomId: string, plan?: string) => `/rooms/${roomId}/plan/checkout${plan ? `?plan=${plan}` : ''}`,
  roomPlanDone: (roomId: string, plan?: string) => `/rooms/${roomId}/plan/done${plan ? `?plan=${plan}` : ''}`,
  roomShare: (roomId: string) => `/rooms/${roomId}/share`,
  inviteJoin: (inviteToken: string) => `/invite/${inviteToken}`,
  photoUpload: (roomId: string) => `/rooms/${roomId}/photos/new`,
  firstEntry: (roomId: string) => `/rooms/${roomId}/entries/new`,
  // 참여자 토큰이 방마다 있어서 방 id도 주소에 넣는다
  askback: (roomId: string, askbackId: string) => `/rooms/${roomId}/askbacks/${askbackId}`,
  roomCirculation: (roomId: string) => `/rooms/${roomId}/circulation`,
  roomWeaving: (roomId: string) => `/rooms/${roomId}/weaving`,
  terms: () => '/terms',
  privacy: () => '/privacy',
}
