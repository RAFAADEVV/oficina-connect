import { Link } from 'react-router'
import { Icon } from '../../components/ui'
import { usePageTitle } from '../../lib/usePageTitle'

export function NaoEncontradaPage() {
  usePageTitle('Página não encontrada')

  return (
    <div className="flex flex-col items-center py-20 text-center">
      <p className="text-sm font-semibold text-brand-700">Erro 404</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">Página não encontrada</h1>
      <p className="mt-2 text-sm text-slate-500">O endereço que procurou não existe ou foi alterado.</p>
      <Link
        to="/"
        className="mt-6 inline-flex h-10 items-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-medium text-ink hover:bg-brand-500"
      >
        <Icon name="arrowLeft" className="size-4" />
        Voltar ao Dashboard
      </Link>
    </div>
  )
}
