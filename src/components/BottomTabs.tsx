import { NavLink } from 'react-router'
import { paths } from '../routes/paths'

function ListIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <rect x="4" y="4" width="16" height="16" rx="4" />
      <path d="M8 10h8M8 14h5" strokeLinecap="round" />
    </svg>
  )
}

function PinIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <path d="M12 21s-6.5-6.2-6.5-11.2a6.5 6.5 0 0 1 13 0C18.5 14.8 12 21 12 21Z" />
      <circle cx="12" cy="9.8" r="2.3" />
    </svg>
  )
}

const TABS = [
  { to: paths.roomList(), label: '모임방', icon: <ListIcon /> },
  { to: paths.recordMap(), label: '기록 지도', icon: <PinIcon /> },
]

/** 모임방 목록과 기록 지도를 오가는 아래 탭 */
function BottomTabs() {
  return (
    <nav
      aria-label="주요 화면"
      className="fixed inset-x-0 bottom-0 z-30 mx-auto grid max-w-[430px] grid-cols-2 border-t border-line bg-surface pt-2 pb-[max(10px,env(safe-area-inset-bottom))]"
    >
      {TABS.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end
          replace
          className={({ isActive }) =>
            `flex flex-col items-center gap-1 text-[11px] ${isActive ? 'font-bold text-ink' : 'text-muted'}`
          }
        >
          {tab.icon}
          {tab.label}
        </NavLink>
      ))}
    </nav>
  )
}

/** 아래 탭에 가려지지 않게 화면 맨 아래에 두는 여백 */
export const BOTTOM_TABS_SPACE = 'pb-[calc(76px+env(safe-area-inset-bottom))]'

export default BottomTabs
