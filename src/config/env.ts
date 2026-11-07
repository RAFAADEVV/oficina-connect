/**
 * Leitura centralizada das variáveis de ambiente.
 *
 * Regras de segurança:
 * - Só variáveis com o prefixo VITE_ chegam ao navegador. Tudo o que estiver aqui é PÚBLICO.
 * - A chave "anon/publishable" do Supabase pode estar no frontend: a proteção real
 *   dos dados é feita pelas políticas de Row Level Security (RLS) na base de dados.
 * - A chave "service_role" (ou "secret") NUNCA pode ser colocada aqui nem em nenhum ficheiro .env
 *   usado pelo frontend, porque ignora o RLS e dá acesso total à base de dados.
 */

export interface SupabaseEnv {
  url: string
  anonKey: string
}

function readOptional(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

const supabaseUrl = readOptional(import.meta.env.VITE_SUPABASE_URL)
const supabaseAnonKey = readOptional(import.meta.env.VITE_SUPABASE_ANON_KEY)

/** Indica se as variáveis do Supabase foram preenchidas no ficheiro .env.local. */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

/**
 * Devolve a configuração do Supabase ou lança um erro claro se faltar alguma variável.
 * Será usado quando ligarmos a base de dados (próximas tarefas).
 */
export function getSupabaseEnv(): SupabaseEnv {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Configuração do Supabase em falta. Copie .env.example para .env.local e preencha VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.',
    )
  }
  return { url: supabaseUrl, anonKey: supabaseAnonKey }
}

/**
 * Chave PÚBLICA do Cloudflare Turnstile (verificação anti-robô), opcional.
 * A chave secreta fica só no Supabase, nunca aqui.
 */
export const turnstileSiteKey = readOptional(import.meta.env.VITE_TURNSTILE_SITE_KEY)

/** true quando a verificação anti-robô (Turnstile) está configurada */
export const isCaptchaEnabled = Boolean(turnstileSiteKey)

/**
 * Contactos mostrados na página inicial (opcionais, públicos).
 * WhatsApp: número com indicativo, só algarismos (ex.: 351912345678).
 * Sem valor, o respetivo botão não aparece.
 */
const whatsappDigits = readOptional(import.meta.env.VITE_CONTACT_WHATSAPP)?.replace(/\D/g, '')
export const contactWhatsapp = whatsappDigits && whatsappDigits.length >= 9 ? whatsappDigits : undefined
const email = readOptional(import.meta.env.VITE_CONTACT_EMAIL)
export const contactEmail = email && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ? email : undefined
