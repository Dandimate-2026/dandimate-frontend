import type { MemoryPhoto, PreviewScreen } from './types'

export const PREVIEW_SCREENS: { id: PreviewScreen; title: string; detail: string }[] = [
  { id: 's6-1', title: '돌려보기 · 내 기억 전', detail: '내 이야기를 남기기 전의 잠금 상태' },
  { id: 's6-2', title: '덧붙이기', detail: '말이나 글로 기억을 남기는 입력 시트' },
  { id: 's6-3', title: '돌려보기 · 이야기 열람', detail: '친구들의 이야기와 내 덧붙임' },
  { id: 's6-4', title: '패스한 사진', detail: '패스를 덧붙임으로 바꾸기' },
  { id: 's6-5', title: '다 봤어요', detail: '참여 결과와 공유' },
  { id: 's8', title: '엮는 중', detail: '이야기를 엮는 대기 화면' },
  { id: 's9', title: '두루마리', detail: '함께 모은 기억과 서로 다른 이야기' },
  { id: 's10', title: '답가 쓰기', detail: '두루마리에 더 남기고 싶은 이야기' },
]

export const MEMORY_PHOTOS: MemoryPhoto[] = [
  {
    id: 'cafe', owner: '지수', flower: 'blue', location: '황리단길 카페', dateLabel: '경주 · 10. 17',
    firstStory: { author: '지수', kind: '첫 한마디', text: '다들 여기서 시험얘기하다가 조용해졌잖아ㅋㅋ' },
    friends: [{ author: '민지', flower: 'orange', kind: '덧붙임', text: '여기서 두시간 넘게 앉아있었음' }],
  },
  {
    id: 'observatory', owner: '서연', flower: 'pink', location: '첨성대 앞', dateLabel: '경주 · 10. 17',
    firstStory: { author: '서연', kind: '첫 한마디', durationLabel: '0:18', text: '이 사진 진짜 웃겼던 건데 왜 웃었는지\n기억이 안 나' },
    friends: [{ author: '지수', flower: 'blue', kind: '덧붙임', durationLabel: '0:09', text: '민지 타이머 맞추고 뛰어오다가 신발\n벗겨졌잖아' }],
  },
  {
    id: 'park', owner: '지수', flower: 'blue', location: '대릉원', dateLabel: '경주 · 10. 17',
    firstStory: { author: '지수', kind: '첫 한마디', text: '여기서 길 잃어서 30분 돌았음' },
    friends: [{ author: '서연', flower: 'pink', kind: '덧붙임', text: '지수가 지도 거꾸로 봄' }],
  },
  {
    id: 'evening', owner: '서연', flower: 'pink', location: '첨성대 앞', dateLabel: '경주 · 10. 17',
    firstStory: { author: '서연', kind: '첫 한마디', text: '첨성대 앞에서 한참을 웃었지. 그날 바람도 참 좋았어.' },
    friends: [{ author: '지수', flower: 'blue', kind: '덧붙임', text: '셔터를 누르는데 민지가 화면에서 사라졌어.' }],
  },
  {
    id: 'last-cafe', owner: '지수', flower: 'blue', location: '황리단길 카페', dateLabel: '경주 · 10. 18',
    firstStory: { author: '지수', kind: '첫 한마디', text: '다음에도 같이 오자고 했던 카페.' },
    friends: [{ author: '서연', flower: 'pink', kind: '덧붙임', text: '창가 자리가 참 좋았어.' }],
  },
]
