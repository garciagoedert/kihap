export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      units: {
        Row: {
          id: number
          name: string
          city: string
          state: string
          address: string
          phone: string
          manager: string
          created_at: string
        }
        Insert: {
          id?: number
          name: string
          city: string
          state: string
          address: string
          phone: string
          manager: string
          created_at?: string
        }
        Update: {
          id?: number
          name?: string
          city?: string
          state?: string
          address?: string
          phone?: string
          manager?: string
          created_at?: string
        }
      }
      students: {
        Row: {
          id: number
          name: string
          belt: string
          age: number
          registration_date: string
          last_attendance: string
          unit_id: number
          birth_date: string
          cpf: string
          rg?: string
          email?: string
          phone: string
          emergency_contact: string
          emergency_phone: string
          address: string
          neighborhood: string
          city: string
          state: string
          zip_code: string
          blood_type?: string
          weight?: string
          height?: string
          health_issues?: string
          medications?: string
          guardian_name?: string
          guardian_cpf?: string
          guardian_phone?: string
          training_days: string[]
          training_schedule: string
          payment_day: number
          observations?: string
          contract_active: boolean
          contract_plan_name?: string
          contract_start_date?: string
          contract_end_date?: string
          contract_value?: number
          created_at: string
        }
        Insert: {
          id?: number
          name: string
          belt: string
          age: number
          registration_date: string
          last_attendance: string
          unit_id: number
          birth_date: string
          cpf: string
          rg?: string
          email?: string
          phone: string
          emergency_contact: string
          emergency_phone: string
          address: string
          neighborhood: string
          city: string
          state: string
          zip_code: string
          blood_type?: string
          weight?: string
          height?: string
          health_issues?: string
          medications?: string
          guardian_name?: string
          guardian_cpf?: string
          guardian_phone?: string
          training_days: string[]
          training_schedule: string
          payment_day: number
          observations?: string
          contract_active: boolean
          contract_plan_name?: string
          contract_start_date?: string
          contract_end_date?: string
          contract_value?: number
          created_at?: string
        }
        Update: {
          id?: number
          name?: string
          belt?: string
          age?: number
          registration_date?: string
          last_attendance?: string
          unit_id?: number
          birth_date?: string
          cpf?: string
          rg?: string
          email?: string
          phone?: string
          emergency_contact?: string
          emergency_phone?: string
          address?: string
          neighborhood?: string
          city?: string
          state?: string
          zip_code?: string
          blood_type?: string
          weight?: string
          height?: string
          health_issues?: string
          medications?: string
          guardian_name?: string
          guardian_cpf?: string
          guardian_phone?: string
          training_days?: string[]
          training_schedule?: string
          payment_day?: number
          observations?: string
          contract_active?: boolean
          contract_plan_name?: string
          contract_start_date?: string
          contract_end_date?: string
          contract_value?: number
          created_at?: string
        }
      }
      users: {
        Row: {
          id: number
          name: string
          email: string
          password_hash: string
          role: string
          unit_id?: number
          created_at: string
        }
        Insert: {
          id?: number
          name: string
          email: string
          password_hash: string
          role: string
          unit_id?: number
          created_at?: string
        }
        Update: {
          id?: number
          name?: string
          email?: string
          password_hash?: string
          role?: string
          unit_id?: number
          created_at?: string
        }
      }
      classes: {
        Row: {
          id: number
          name: string
          unit_id: number
          week_day: string
          start_time: string
          end_time: string
          max_students: number
          description?: string
          created_at: string
        }
        Insert: {
          id?: number
          name: string
          unit_id: number
          week_day: string
          start_time: string
          end_time: string
          max_students: number
          description?: string
          created_at?: string
        }
        Update: {
          id?: number
          name?: string
          unit_id?: number
          week_day?: string
          start_time?: string
          end_time?: string
          max_students?: number
          description?: string
          created_at?: string
        }
      }
      attendance: {
        Row: {
          id: number
          student_id: number
          date: string
          present: boolean
          unit_id: number
          created_at: string
        }
        Insert: {
          id?: number
          student_id: number
          date: string
          present: boolean
          unit_id: number
          created_at?: string
        }
        Update: {
          id?: number
          student_id?: number
          date?: string
          present?: boolean
          unit_id?: number
          created_at?: string
        }
      }
      leads: {
        Row: {
          id: number
          name: string
          email: string
          phone: string
          source?: string
          notes?: string
          value: number
          status: string
          created_at: string
        }
        Insert: {
          id?: number
          name: string
          email: string
          phone: string
          source?: string
          notes?: string
          value: number
          status: string
          created_at?: string
        }
        Update: {
          id?: number
          name?: string
          email?: string
          phone?: string
          source?: string
          notes?: string
          value?: number
          status?: string
          created_at?: string
        }
      }
      messages: {
        Row: {
          id: number
          sender_id: number
          receiver_id: number
          content: string
          timestamp: string
          read: boolean
          created_at: string
        }
        Insert: {
          id?: number
          sender_id: number
          receiver_id: number
          content: string
          timestamp: string
          read: boolean
          created_at?: string
        }
        Update: {
          id?: number
          sender_id?: number
          receiver_id?: number
          content?: string
          timestamp?: string
          read?: boolean
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}