import { useCallback, useEffect, useState } from 'react'
import { getErrorMessage } from '../features/auth/authErrors'

interface AsyncState<T> {
  key: string
  data: T | null
  error: string | null
}

/**
 * Carrega dados de forma assíncrona e volta a carregar quando `key` muda.
 * `key` deve identificar o pedido (ex.: `clientes:${orgId}:${pesquisa}:${pagina}`).
 *
 * Devolve: data, error (já em português), isLoading e reload().
 */
export function useAsyncData<T>(key: string | null, loader: () => Promise<T>) {
  const [state, setState] = useState<AsyncState<T> | null>(null)
  const [reloadCount, setReloadCount] = useState(0)
  const fullKey = key === null ? null : `${key}#${reloadCount}`

  useEffect(() => {
    if (fullKey === null) return
    let cancelled = false
    loader().then(
      (data) => {
        if (!cancelled) setState({ key: fullKey, data, error: null })
      },
      (err: unknown) => {
        if (!cancelled) setState({ key: fullKey, data: null, error: getErrorMessage(err) })
      },
    )
    return () => {
      cancelled = true
    }
    // O loader muda a cada render; só queremos recarregar quando a chave muda.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullKey])

  const reload = useCallback(() => setReloadCount((n) => n + 1), [])
  const current = state && state.key === fullKey ? state : null
  // Enquanto carrega de novo, mantém os dados anteriores visíveis (evita "piscar")
  const previous = state && !current ? state : null

  return {
    data: current?.data ?? previous?.data ?? null,
    error: current?.error ?? null,
    isLoading: fullKey !== null && !current,
    reload,
  }
}
