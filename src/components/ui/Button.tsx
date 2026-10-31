import type { ButtonHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'
import { Icon, type IconName } from './Icon'
import { Spinner } from './Spinner'

type ButtonVariant = 'primary' | 'secondary' | 'ghost'
type ButtonSize = 'sm' | 'md'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  icon?: IconName
  /** Mostra um indicador de carregamento e desativa o botão */
  isLoading?: boolean
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-brand-600 text-white shadow-sm hover:bg-brand-700 disabled:bg-brand-600/50',
  secondary:
    'bg-white text-slate-700 border border-slate-300 shadow-sm hover:bg-slate-50 disabled:text-slate-400',
  ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:text-slate-400',
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-sm gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
}

export function Button({
  variant = 'primary',
  size = 'md',
  icon,
  isLoading = false,
  type = 'button',
  className,
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      className={cn(
        'inline-flex items-center justify-center rounded-lg font-medium transition-colors disabled:cursor-not-allowed',
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...props}
    >
      {isLoading ? <Spinner className="size-4" /> : icon && <Icon name={icon} className="size-4" />}
      {children}
    </button>
  )
}
