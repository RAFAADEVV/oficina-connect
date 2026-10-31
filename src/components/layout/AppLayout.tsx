import { useEffect, useState } from 'react'
import { Outlet } from 'react-router'
import { Icon } from '../ui/Icon'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'

/**
 * Estrutura geral da aplicação:
 * - Desktop (≥1024px): sidebar fixa à esquerda.
 * - Telemóvel/tablet: barra superior com botão que abre a sidebar como painel deslizante.
 */
export function AppLayout() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const closeMenu = () => setIsMobileMenuOpen(false)

  // Fecha o menu com a tecla Esc e impede o scroll da página por trás.
  useEffect(() => {
    if (!isMobileMenuOpen) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsMobileMenuOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = ''
    }
  }, [isMobileMenuOpen])

  return (
    <div className="min-h-dvh">
      {/* Sidebar fixa (desktop) */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-slate-200 lg:block">
        <Sidebar />
      </aside>

      {/* Sidebar deslizante (telemóvel/tablet) */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 bg-slate-900/40" onClick={closeMenu} aria-hidden="true" />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85%] shadow-xl">
            <Sidebar onNavigate={closeMenu} />
            <button
              type="button"
              onClick={closeMenu}
              className="absolute top-4 right-3 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
              aria-label="Fechar menu"
            >
              <Icon name="close" className="size-5" />
            </button>
          </aside>
        </div>
      )}

      <div className="lg:pl-64">
        <Topbar onOpenMenu={() => setIsMobileMenuOpen(true)} />
        <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
