import { RouterProvider } from 'react-router'
import { AuthProvider } from '../features/auth/AuthProvider'
import { OrganizationProvider } from '../features/organization/OrganizationProvider'
import { router } from './router'

/** Raiz da aplicação: sessão → oficina → páginas. */
export default function App() {
  return (
    <AuthProvider>
      <OrganizationProvider>
        <RouterProvider router={router} />
      </OrganizationProvider>
    </AuthProvider>
  )
}
