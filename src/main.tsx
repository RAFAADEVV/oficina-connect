import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ConfigMissing } from './app/ConfigMissing'
import { isSupabaseConfigured } from './config/env'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/manrope/700.css'
import '@fontsource/manrope/800.css'
import './index.css'

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('Elemento #root não encontrado em index.html')
}

const root = createRoot(rootElement)

if (!isSupabaseConfigured) {
  // Sem .env.local preenchido, mostramos instruções em vez de um ecrã em branco.
  root.render(<ConfigMissing />)
} else {
  // A aplicação só é carregada depois de confirmarmos que a configuração existe.
  void import('./app/App').then(({ default: App }) => {
    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    )
  })
}
