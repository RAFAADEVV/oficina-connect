import { Icon } from '../ui/Icon'

interface TopbarProps {
  onOpenMenu: () => void
}

/** Barra superior visível apenas em telemóvel e tablet (abaixo de 1024px). */
export function Topbar({ onOpenMenu }: TopbarProps) {
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/95 px-4 backdrop-blur lg:hidden">
      <button
        type="button"
        onClick={onOpenMenu}
        className="-ml-1 rounded-lg p-2 text-slate-600 hover:bg-slate-100"
        aria-label="Abrir menu"
      >
        <Icon name="menu" className="size-6" />
      </button>
      <img src="/favicon.svg" alt="" className="size-7" />
      <span className="text-base font-semibold tracking-tight text-slate-900">Oficina Connect</span>
    </header>
  )
}
