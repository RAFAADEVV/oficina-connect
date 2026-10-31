import { useEffect } from 'react'

const APP_NAME = 'Oficina Connect'

/** Atualiza o título do separador do navegador, ex.: "Clientes · Oficina Connect". */
export function usePageTitle(title: string): void {
  useEffect(() => {
    document.title = `${title} · ${APP_NAME}`
  }, [title])
}
