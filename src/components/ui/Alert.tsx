import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

type AlertVariant = 'error' | 'success' | 'info'

const variantClasses: Record<AlertVariant, string> = {
  error: 'border-red-200 bg-red-50 text-red-800',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  info: 'border-brand-200 bg-brand-50 text-brand-900',
}

interface AlertProps {
  variant?: AlertVariant
  children: ReactNode
  className?: string
}

/** Mensagem de aviso, erro ou sucesso. Os erros são anunciados aos leitores de ecrã. */
export function Alert({ variant = 'info', children, className }: AlertProps) {
  return (
    <div
      role={variant === 'error' ? 'alert' : 'status'}
      className={cn('rounded-lg border px-4 py-3 text-sm', variantClasses[variant], className)}
    >
      {children}
    </div>
  )
}
