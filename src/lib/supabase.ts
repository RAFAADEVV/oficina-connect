import { createClient } from '@supabase/supabase-js'
import { getSupabaseEnv } from '../config/env'
import type { Database } from '../types/database'

/**
 * Cliente Supabase usado por toda a aplicação (no navegador).
 *
 * Usa apenas a chave pública (publishable/anon). A segurança dos dados é garantida
 * pelas políticas de Row Level Security na base de dados — nunca pela interface.
 *
 * Se as variáveis de ambiente faltarem, getSupabaseEnv() lança um erro com instruções.
 * O main.tsx só carrega a aplicação depois de confirmar que estão preenchidas.
 */
const { url, anonKey } = getSupabaseEnv()

export const supabase = createClient<Database>(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
