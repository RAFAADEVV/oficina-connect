import { useEffect } from 'react'
import { useAuth } from './useAuth'

/** Tempo sem atividade até terminar a sessão (computadores partilhados na oficina). */
export const IDLE_LIMIT_MS = 4 * 60 * 60 * 1000 // 4 horas
const STORAGE_KEY = 'revyauto:ultima-atividade'
const CHECK_EVERY_MS = 60 * 1000
const REASON_KEY = 'revyauto:motivo-saida'

/** Lê (e apaga) o motivo da última saída automática, para o mostrar no ecrã de entrada. */
export function takeLogoutReason(): string | null {
  try {
    const reason = window.sessionStorage.getItem(REASON_KEY)
    window.sessionStorage.removeItem(REASON_KEY)
    return reason
  } catch {
    return null
  }
}

function rememberReason(reason: string): void {
  try {
    window.sessionStorage.setItem(REASON_KEY, reason)
  } catch {
    // sem armazenamento: o ecrã de entrada aparece sem a explicação
  }
}

function readLastActivity(): number | null {
  try {
    const value = Number(window.localStorage.getItem(STORAGE_KEY))
    return Number.isFinite(value) && value > 0 ? value : null
  } catch {
    return null
  }
}

function writeLastActivity(time: number): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(time))
  } catch {
    // Sem acesso ao armazenamento (modo privado): a verificação em memória continua a funcionar
  }
}

/**
 * Termina a sessão depois de algumas horas sem usar a app.
 * A última atividade é partilhada entre separadores, por isso usar um separador mantém os outros ativos.
 */
export function useIdleLogout(limitMs = IDLE_LIMIT_MS): void {
  const { user, signOut } = useAuth()

  useEffect(() => {
    if (!user) return
    let lastActivity = Date.now()
    let lastWrite = 0

    // Ao terminar a sessão, a guarda de rotas leva automaticamente para "Entrar"
    const logout = () => {
      rememberReason('inatividade')
      void signOut()
    }

    // A última atividade guardada só conta se for desta sessão.
    // Se a pessoa acabou de entrar, uma atividade antiga é da sessão anterior e é ignorada.
    const stored = readLastActivity()
    const signedInAt = Date.parse(user.last_sign_in_at ?? '')
    const isFromThisSession = stored !== null && !(signedInAt > stored)
    if (stored && isFromThisSession && Date.now() - stored > limitMs) {
      // A app ficou aberta (ou a sessão guardada) sem uso durante demasiado tempo
      logout()
      return
    }
    writeLastActivity(lastActivity)

    const markActivity = () => {
      lastActivity = Date.now()
      // Escreve no máximo a cada 30 segundos para não sobrecarregar
      if (lastActivity - lastWrite > 30_000) {
        writeLastActivity(lastActivity)
        lastWrite = lastActivity
      }
    }

    const check = () => {
      const latest = Math.max(lastActivity, readLastActivity() ?? 0)
      if (Date.now() - latest > limitMs) logout()
    }

    const events: (keyof WindowEventMap)[] = ['pointerdown', 'keydown', 'wheel', 'touchstart']
    events.forEach((name) => window.addEventListener(name, markActivity, { passive: true }))
    document.addEventListener('visibilitychange', check)
    const timer = window.setInterval(check, CHECK_EVERY_MS)

    return () => {
      events.forEach((name) => window.removeEventListener(name, markActivity))
      document.removeEventListener('visibilitychange', check)
      window.clearInterval(timer)
    }
  }, [user, signOut, limitMs])
}