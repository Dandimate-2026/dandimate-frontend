/** 글자 수 제한에 닿으면 "최대 N자까지 쓸 수 있어요"를 보여준다 */
export function LengthNotice({ length, max, className = '' }: { length: number; max: number; className?: string }) {
  if (length < max) return null
  return (
    <p className={`mt-1 text-[11px] text-point ${className}`} role="status">
      최대 {max}자까지 쓸 수 있어요
    </p>
  )
}
