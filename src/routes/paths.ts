// 화면 경로를 한곳에서 관리한다. 페이지에서는 문자열 대신 이 함수를 쓴다.

export const paths = {
  // 이 기기에 저장된 방이 없으면 방 만들기로 보낸다
  roomList: () => '/',
  roomCreate: () => '/rooms/new',
  roomHome: (roomId: string) => `/rooms/${roomId}`,
  roomShare: (roomId: string) => `/rooms/${roomId}/share`,
  inviteJoin: (inviteToken: string) => `/invite/${inviteToken}`,
  photoUpload: (roomId: string) => `/rooms/${roomId}/photos/new`,
  firstEntry: (roomId: string) => `/rooms/${roomId}/entries/new`,
  // 참여자 토큰이 방마다 있어서 방 id도 주소에 넣는다
  askback: (roomId: string, askbackId: string) => `/rooms/${roomId}/askbacks/${askbackId}`,
  // TODO: 아래 화면은 아직 없음
  roomCirculation: (roomId: string) => `/rooms/${roomId}/circulation`,
  terms: () => '/terms',
}
