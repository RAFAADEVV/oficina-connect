import { cn } from '../../lib/cn'

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-block size-5 animate-spin rounded-full border-2 border-current border-r-transparent',
        className,
      )}
      aria-hidden="true"
    />
  )
}

/** Ecrã de carregamento a ocupar a página inteira. */
export function FullPageLoader({ label = 'A carregar…' }: { label?: string }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-50 text-brand-600" role="status">
      <Spinner className="size-7" />
      <span className="sr-only">{label}</span>
    </div>
  )
}
