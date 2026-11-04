import { useRouteError } from 'react-router'

/**
 * Mostrado se uma página falhar inesperadamente.
 * Não mostramos detalhes técnicos ao utilizador; em desenvolvimento o erro fica na consola.
 */
export function ErrorPage() {
  const error = useRouteError()

  if (import.meta.env.DEV) {
    console.error(error)
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-slate-50 px-6 text-center">
      <h1 className="text-xl font-semibold text-slate-900">Ocorreu um erro inesperado</h1>
      <p className="mt-2 max-w-md text-sm text-slate-500">
        Tente recarregar a página. Se o problema continuar, contacte o suporte.
      </p>
      <a
        href="/"
        className="mt-6 inline-flex h-10 items-center rounded-lg bg-brand-600 px-4 text-sm font-medium text-ink hover:bg-brand-500"
      >
        Voltar ao início
      </a>
    </div>
  )
}
