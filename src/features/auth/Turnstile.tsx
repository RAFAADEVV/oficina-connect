import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { turnstileSiteKey } from '../../config/env'

/**
 * Verificação anti-robô do Cloudflare Turnstile (gratuita e sem "escolha as passadeiras").
 * Só aparece quando VITE_TURNSTILE_SITE_KEY está definida.
 * Tem de estar ligada também no Supabase (Authentication → Attack Protection → CAPTCHA).
 */

interface TurnstileApi {
  render: (el: HTMLElement, options: Record<string, unknown>) => string
  reset: (widgetId: string) => void
  remove: (widgetId: string) => void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

const SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
let scriptPromise: Promise<void> | null = null

function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve()
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = SCRIPT_URL
      script.async = true
      script.onload = () => resolve()
      script.onerror = () => {
        scriptPromise = null
        reject(new Error('Não foi possível carregar a verificação de segurança.'))
      }
      document.head.appendChild(script)
    })
  }
  return scriptPromise
}


export interface TurnstileHandle {
  /** Os tokens só servem uma vez: chamar depois de cada tentativa */
  reset: () => void
}

interface TurnstileProps {
  onToken: (token: string | null) => void
}

export const Turnstile = forwardRef<TurnstileHandle, TurnstileProps>(function Turnstile({ onToken }, ref) {
  const containerRef = useRef<HTMLDivElement>(null)
  const widgetId = useRef<string | null>(null)
  const onTokenRef = useRef(onToken)

  useEffect(() => {
    onTokenRef.current = onToken
  }, [onToken])

  useImperativeHandle(ref, () => ({
    reset: () => {
      if (widgetId.current && window.turnstile) window.turnstile.reset(widgetId.current)
      onTokenRef.current(null)
    },
  }))

  useEffect(() => {
    if (!turnstileSiteKey) return
    let cancelled = false
    loadScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.turnstile) return
        widgetId.current = window.turnstile.render(containerRef.current, {
          sitekey: turnstileSiteKey,
          language: 'pt-PT',
          theme: 'light',
          callback: (token: string) => onTokenRef.current(token),
          'expired-callback': () => onTokenRef.current(null),
          'error-callback': () => onTokenRef.current(null),
        })
      })
      .catch(() => onTokenRef.current(null))
    return () => {
      cancelled = true
      if (widgetId.current && window.turnstile) window.turnstile.remove(widgetId.current)
      widgetId.current = null
    }
  }, [])

  if (!turnstileSiteKey) return null
  return <div ref={containerRef} className="min-h-[65px]" />
})
