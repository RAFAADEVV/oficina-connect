import { useEffect } from 'react'

const APP_NAME = 'RevyAuto'

/** Atualiza o título do separador do navegador, ex.: "Clientes · RevyAuto". */
export function usePageTitle(title: string): void {
  useEffect(() => {
    document.title = `${title} · ${APP_NAME}`
  }, [title])
}
