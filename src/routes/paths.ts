// 화면 경로를 한곳에서 관리한다. 페이지에서는 문자열 대신 이 함수를 쓴다.

export const paths = {
  roomHome: (roomId: string) => `/rooms/${roomId}`,
  roomShare: (roomId: string) => `/rooms/${roomId}/share`,
  inviteJoin: (inviteToken: string) => `/invite/${inviteToken}`,
  photoUpload: (roomId: string) => `/rooms/${roomId}/photos/new`,
  // TODO: 아래 화면은 아직 없음
  roomCirculation: (roomId: string) => `/rooms/${roomId}/circulation`,
  askback: (askbackId: string) => `/askbacks/${askbackId}`,
  terms: () => '/terms',
  firstEntry: (roomId: string) => `/rooms/${roomId}/entries/new`,
}
