/// <reference types="vite/client" />

/** Tipos das variáveis de ambiente públicas (prefixo VITE_). */
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
