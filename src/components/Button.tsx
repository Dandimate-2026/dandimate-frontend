import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'outline' | 'text'

const variantClass: Record<Variant, string> = {
  primary:
    'h-[52px] rounded-full bg-ink text-surface disabled:bg-disabled disabled:cursor-not-allowed',
  outline: 'rounded-2xl border border-line bg-surface text-ink',
  text: 'h-[52px] text-ink',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
}

function Button({ variant = 'primary', className = '', ...props }: ButtonProps) {
  return (
    <button
      type="button"
      className={`text-[15px] font-semibold transition-opacity active:opacity-80 ${variantClass[variant]} ${className}`}
      {...props}
    />
  )
}

export default Button
