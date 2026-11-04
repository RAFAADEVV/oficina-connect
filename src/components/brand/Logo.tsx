import { cn } from '../../lib/cn'

interface LogoMarkProps {
  size?: number
  className?: string
  /** Fundo do quadrado (mais claro quando o logótipo está sobre fundo escuro) */
  background?: string
}

/**
 * Símbolo RevyAuto: anel laranja com seta (o cliente volta) e ponto central.
 * Igual a public/brand/revyauto-icone.svg.
 */
export function LogoMark({ size = 32, className, background = '#1E2430' }: LogoMarkProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={cn('shrink-0', className)} aria-hidden="true">
      <rect width="64" height="64" rx="11" fill={background} />
      <path
        d="M42.5 13.81 A21 21 0 1 1 19.07 15.45"
        fill="none"
        stroke="#E85D04"
        strokeWidth={size < 24 ? 7 : 5.8}
        strokeLinecap="round"
      />
      <path d="M15.62 11.04 L24.43 11.26 L22.52 19.86 Z" fill="#E85D04" stroke="#E85D04" strokeWidth="1.2" strokeLinejoin="round" />
      <circle cx="32" cy="32" r={size < 24 ? 6 : 5.6} fill="#FFFFFF" />
    </svg>
  )
}

interface LogoProps {
  size?: 'sm' | 'md' | 'lg'
  /** Versão para fundo escuro */
  inverted?: boolean
  className?: string
}

const sizes = {
  sm: { mark: 28, text: 'text-lg' },
  md: { mark: 32, text: 'text-xl' },
  lg: { mark: 40, text: 'text-2xl' },
}

/** Logótipo completo: símbolo + nome "RevyAuto". */
export function Logo({ size = 'md', inverted = false, className }: LogoProps) {
  const s = sizes[size]
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <LogoMark size={s.mark} background={inverted ? '#2A3240' : '#1E2430'} />
      <span
        className={cn('font-display font-extrabold tracking-tight', s.text, inverted ? 'text-white' : 'text-graphite')}
      >
        Revy<span className={inverted ? 'text-[#FF7A2E]' : 'text-brand-600'}>Auto</span>
      </span>
    </span>
  )
}
