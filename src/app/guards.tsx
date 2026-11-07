import { Navigate, Outlet, useLocation } from 'react-router'
import { Alert, Button, FullPageLoader } from '../components/ui'
import { useAuth } from '../features/auth/useAuth'
import { useOrganization } from '../features/organization/useOrganization'
import { hasLogoutReason } from '../features/auth/useIdleLogout'
import { LandingPage } from '../pages/inicio/LandingPage'

/**
 * "Guardas" de rotas: decidem para onde o utilizador vai consoante o seu estado.
 *
 * IMPORTANTE: isto só serve para a experiência de navegação.
 * A proteção real dos dados está nas regras RLS da base de dados.
 */

export const MFA_PATH = '/verificar-codigo'

/**
 * Só deixa passar quem tem sessão iniciada (os outros vão para /entrar)
 * e, se a conta tiver autenticação em dois passos, quem já introduziu o código.
 */
export function RequireAuth() {
  const { user, isLoading, needsMfa } = useAuth()
  const location = useLocation()

  if (isLoading) return <FullPageLoader />
  if (!user) {
    // Visitantes no endereço principal veem a página inicial; nas outras páginas, vão entrar.
    // Depois de uma saída por inatividade, vão para "Entrar" para verem o aviso.
    if (location.pathname === '/' && !hasLogoutReason()) return <LandingPage />
    return <Navigate to="/entrar" replace state={{ from: location.pathname }} />
  }
  if (needsMfa && location.pathname !== MFA_PATH) {
    return <Navigate to={MFA_PATH} replace state={{ from: location.pathname }} />
  }
  if (!needsMfa && location.pathname === MFA_PATH) {
    const from = (location.state as { from?: string } | null)?.from
    return <Navigate to={from && from !== MFA_PATH ? from : '/'} replace />
  }
  return <Outlet />
}

/** Só deixa passar quem já tem uma oficina. Os outros vão criar a sua. */
export function RequireOrganization() {
  const { organization, isLoading, error, reload } = useOrganization()

  if (isLoading) return <FullPageLoader />
  if (error) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-sm space-y-4 text-center">
          <Alert variant="error">{error}</Alert>
          <Button variant="secondary" onClick={() => void reload()}>
            Tentar novamente
          </Button>
        </div>
      </div>
    )
  }
  if (!organization) return <Navigate to="/criar-oficina" replace />
  return <Outlet />
}

/** Páginas como "Entrar" ou "Criar conta": quem já tem sessão vai para o Dashboard. */
export function GuestOnly() {
  const { user, isLoading, isPasswordRecovery } = useAuth()

  if (isLoading) return <FullPageLoader />
  if (user && !isPasswordRecovery) return <Navigate to="/" replace />
  return <Outlet />
}
