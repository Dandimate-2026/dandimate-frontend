import type { ReactNode } from 'react'

function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-[20px] border border-line bg-surface px-[26px] py-4 ${className}`}>
      {children}
    </section>
  )
}

export default Card
