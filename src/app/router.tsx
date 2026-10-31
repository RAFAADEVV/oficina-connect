import { createBrowserRouter } from 'react-router'
import { AppLayout } from '../components/layout/AppLayout'
import { CriarContaPage } from '../pages/auth/CriarContaPage'
import { CriarOficinaPage } from '../pages/auth/CriarOficinaPage'
import { EntrarPage } from '../pages/auth/EntrarPage'
import { NovaPasswordPage } from '../pages/auth/NovaPasswordPage'
import { RecuperarPasswordPage } from '../pages/auth/RecuperarPasswordPage'
import { ClientesPage } from '../pages/clientes/ClientesPage'
import { DashboardPage } from '../pages/dashboard/DashboardPage'
import { DefinicoesPage } from '../pages/definicoes/DefinicoesPage'
import { NaoEncontradaPage } from '../pages/nao-encontrada/NaoEncontradaPage'
import { OportunidadesPage } from '../pages/oportunidades/OportunidadesPage'
import { VeiculosPage } from '../pages/veiculos/VeiculosPage'
import { ErrorPage } from './ErrorPage'
import { GuestOnly, RequireAuth, RequireOrganization } from './guards'

/**
 * Rotas da aplicação.
 *
 * - Páginas de conta (entrar, criar conta, recuperar password): só para quem NÃO tem sessão.
 * - Criar oficina: precisa de sessão, mas ainda não de oficina.
 * - Resto da aplicação: precisa de sessão E de oficina.
 *
 * Lembrete: estas regras só controlam a navegação. Os dados estão protegidos pelo RLS.
 */
export const router = createBrowserRouter([
  {
    errorElement: <ErrorPage />,
    children: [
      {
        element: <GuestOnly />,
        children: [
          { path: 'entrar', element: <EntrarPage /> },
          { path: 'criar-conta', element: <CriarContaPage /> },
          { path: 'recuperar-password', element: <RecuperarPasswordPage /> },
        ],
      },
      { path: 'nova-password', element: <NovaPasswordPage /> },
      {
        element: <RequireAuth />,
        children: [
          { path: 'criar-oficina', element: <CriarOficinaPage /> },
          {
            element: <RequireOrganization />,
            children: [
              {
                path: '/',
                element: <AppLayout />,
                children: [
                  { index: true, element: <DashboardPage /> },
                  { path: 'clientes', element: <ClientesPage /> },
                  { path: 'veiculos', element: <VeiculosPage /> },
                  { path: 'oportunidades', element: <OportunidadesPage /> },
                  { path: 'definicoes', element: <DefinicoesPage /> },
                  { path: '*', element: <NaoEncontradaPage /> },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
])
