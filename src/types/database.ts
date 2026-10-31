/**
 * Tipos da base de dados (correspondem a supabase/migrations/0001_contas_e_oficinas.sql).
 *
 * Mais tarde podem ser gerados automaticamente com a CLI do Supabase
 * (`supabase gen types typescript`). Até lá, manter este ficheiro alinhado
 * com as migrações sempre que uma tabela mudar.
 */

export type OrganizationRole = 'owner' | 'member'

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: '13'
  }
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string
          name: string
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: never
        Update: {
          name?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          id: string
          full_name: string | null
          created_at: string
          updated_at: string
        }
        Insert: never
        Update: {
          full_name?: string | null
        }
        Relationships: []
      }
      organization_members: {
        Row: {
          organization_id: string
          user_id: string
          role: OrganizationRole
          created_at: string
        }
        Insert: never
        Update: never
        Relationships: []
      }
    }
    Views: Record<never, never>
    Functions: {
      create_organization: {
        Args: { p_name: string }
        Returns: string
      }
    }
    Enums: {
      organization_role: OrganizationRole
    }
    CompositeTypes: Record<never, never>
  }
}
