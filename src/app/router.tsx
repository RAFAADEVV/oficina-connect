import { createBrowserRouter } from 'react-router'
import { AppLayout } from '../components/layout/AppLayout'
import { ClientesPage } from '../pages/clientes/ClientesPage'
import { DashboardPage } from '../pages/dashboard/DashboardPage'
import { DefinicoesPage } from '../pages/definicoes/DefinicoesPage'
import { NaoEncontradaPage } from '../pages/nao-encontrada/NaoEncontradaPage'
import { OportunidadesPage } from '../pages/oportunidades/OportunidadesPage'
import { VeiculosPage } from '../pages/veiculos/VeiculosPage'
import { ErrorPage } from './ErrorPage'

/**
 * Rotas da aplicação. Todas as páginas partilham o AppLayout (sidebar + área principal).
 * Quando houver autenticação, as rotas protegidas ficarão dentro de um "guard" de sessão.
 */
export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    errorElement: <ErrorPage />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'clientes', element: <ClientesPage /> },
      { path: 'veiculos', element: <VeiculosPage /> },
      { path: 'oportunidades', element: <OportunidadesPage /> },
      { path: 'definicoes', element: <DefinicoesPage /> },
      { path: '*', element: <NaoEncontradaPage /> },
    ],
  },
])
