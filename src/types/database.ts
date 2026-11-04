/**
 * Tipos da base de dados (correspondem a supabase/migrations/0001_contas_e_oficinas.sql).
 *
 * Mais tarde podem ser gerados automaticamente com a CLI do Supabase
 * (`supabase gen types typescript`). Até lá, manter este ficheiro alinhado
 * com as migrações sempre que uma tabela mudar.
 */

export type OrganizationRole = 'owner' | 'member'
export type ServiceType = 'revisao' | 'oleo' | 'pneus' | 'travoes' | 'reparacao' | 'outro'
export type ReminderStage = 'mes' | 'semana' | 'atrasado'
export type ContactOutcome = 'enviado' | 'agendado' | 'sem_resposta' | 'ja_fez' | 'nao_quer'
export type DueSource = 'combinado' | 'combinado_km' | 'habito' | 'padrao'

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

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
          service_interval_months: number
          address: string | null
          phone: string | null
          email: string | null
          nif: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: never
        Update: {
          name?: string
          service_interval_months?: number
          address?: string | null
          phone?: string | null
          email?: string | null
          nif?: string | null
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
      customers: {
        Row: {
          id: string
          organization_id: string
          full_name: string
          phone: string
          email: string | null
          nif: string | null
          address: string | null
          notes: string | null
          contact_opt_out: boolean
          contact_opt_out_at: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          organization_id: string
          full_name: string
          phone: string
          email?: string | null
          nif?: string | null
          address?: string | null
          notes?: string | null
          contact_opt_out?: boolean
        }
        Update: {
          full_name?: string
          phone?: string
          email?: string | null
          nif?: string | null
          address?: string | null
          notes?: string | null
          contact_opt_out?: boolean
        }
        Relationships: []
      }
      vehicles: {
        Row: {
          id: string
          organization_id: string
          customer_id: string | null
          plate: string
          make: string | null
          model: string | null
          year: number | null
          mileage: number | null
          notes: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          organization_id: string
          customer_id?: string | null
          plate: string
          make?: string | null
          model?: string | null
          year?: number | null
          mileage?: number | null
          notes?: string | null
        }
        Update: {
          customer_id?: string | null
          plate?: string
          make?: string | null
          model?: string | null
          year?: number | null
          mileage?: number | null
          notes?: string | null
        }
        Relationships: []
      }
      service_records: {
        Row: {
          id: string
          organization_id: string
          vehicle_id: string
          service_date: string
          description: string
          mileage: number | null
          service_type: ServiceType
          next_service_date: string | null
          next_service_mileage: number | null
          problem: string | null
          work_done: string | null
          checklist: string[]
          recommendations: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          organization_id: string
          vehicle_id: string
          service_date: string
          description: string
          mileage?: number | null
          service_type?: ServiceType
          next_service_date?: string | null
          next_service_mileage?: number | null
        }
        Update: {
          service_date?: string
          description?: string
          mileage?: number | null
          service_type?: ServiceType
          next_service_date?: string | null
          next_service_mileage?: number | null
        }
        Relationships: []
      }
      service_parts: {
        Row: {
          id: string
          organization_id: string
          service_record_id: string
          position: number
          description: string
          reference: string | null
          quantity: number
          created_at: string
        }
        Insert: never
        Update: never
        Relationships: []
      }
      contact_logs: {
        Row: {
          id: string
          organization_id: string
          customer_id: string
          vehicle_id: string
          due_date: string
          stage: ReminderStage
          channel: 'whatsapp' | 'telefone' | 'outro'
          outcome: ContactOutcome
          notes: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          organization_id: string
          customer_id: string
          vehicle_id: string
          due_date: string
          stage: ReminderStage
          channel?: 'whatsapp' | 'telefone' | 'outro'
          outcome?: ContactOutcome
          notes?: string | null
        }
        Update: {
          outcome?: ContactOutcome
          notes?: string | null
        }
        Relationships: []
      }
      audit_events: {
        Row: {
          id: number
          organization_id: string
          actor_id: string | null
          action: 'delete'
          table_name: string
          record_id: string
          created_at: string
        }
        Insert: never
        Update: never
        Relationships: []
      }
      imports: {
        Row: {
          id: string
          organization_id: string
          file_name: string
          rows_total: number
          rows_skipped: number
          customers_created: number
          vehicles_created: number
          services_created: number
          created_by: string | null
          created_at: string
        }
        Insert: {
          organization_id: string
          file_name: string
          rows_total?: number
          rows_skipped?: number
          customers_created?: number
          vehicles_created?: number
          services_created?: number
        }
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
      create_service_record: {
        Args: { p_vehicle_id: string; p_service: Json; p_parts?: Json }
        Returns: string
      }
      get_service_reminders: {
        Args: { p_organization_id: string; p_today?: string }
        Returns: {
          vehicle_id: string
          customer_id: string
          customer_name: string
          customer_phone: string
          plate: string
          make: string | null
          model: string | null
          last_service_date: string
          last_service_mileage: number | null
          due_date: string
          due_mileage: number | null
          due_source: DueSource
          stage: ReminderStage
          contacted_at: string | null
          contact_id: string | null
          contact_stage: ReminderStage | null
          contact_outcome: ContactOutcome | null
        }[]
      }
      import_records: {
        Args: { p_organization_id: string; p_rows: Json }
        Returns: Json
      }
    }
    Enums: {
      organization_role: OrganizationRole
    }
    CompositeTypes: Record<never, never>
  }
}
