export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      iara_acoes_penais: {
        Row: {
          classe: string | null
          criminal: boolean | null
          data_ajuizamento: string | null
          dias_sem_tramitacao: number | null
          dt_julgamento: string | null
          fonte: string
          grau: string | null
          id: number
          id_orgao_julgador: number | null
          numero: string | null
          orgao_julgador: string | null
          procedimento: string | null
          sigilo: number | null
          sistema: string | null
        }
        Insert: {
          classe?: string | null
          criminal?: boolean | null
          data_ajuizamento?: string | null
          dias_sem_tramitacao?: number | null
          dt_julgamento?: string | null
          fonte?: string
          grau?: string | null
          id?: number
          id_orgao_julgador?: number | null
          numero?: string | null
          orgao_julgador?: string | null
          procedimento?: string | null
          sigilo?: number | null
          sistema?: string | null
        }
        Update: {
          classe?: string | null
          criminal?: boolean | null
          data_ajuizamento?: string | null
          dias_sem_tramitacao?: number | null
          dt_julgamento?: string | null
          fonte?: string
          grau?: string | null
          id?: number
          id_orgao_julgador?: number | null
          numero?: string | null
          orgao_julgador?: string | null
          procedimento?: string | null
          sigilo?: number | null
          sistema?: string | null
        }
        Relationships: []
      }
      iara_alertas: {
        Row: {
          ativo: boolean
          criado_em: string
          id: string
          mensagem: string
          origem: string | null
          resolvido_em: string | null
          severidade: Database["public"]["Enums"]["iara_alert_severity"]
          titulo: string
          unidade: string | null
        }
        Insert: {
          ativo?: boolean
          criado_em?: string
          id?: string
          mensagem: string
          origem?: string | null
          resolvido_em?: string | null
          severidade?: Database["public"]["Enums"]["iara_alert_severity"]
          titulo: string
          unidade?: string | null
        }
        Update: {
          ativo?: boolean
          criado_em?: string
          id?: string
          mensagem?: string
          origem?: string | null
          resolvido_em?: string | null
          severidade?: Database["public"]["Enums"]["iara_alert_severity"]
          titulo?: string
          unidade?: string | null
        }
        Relationships: []
      }
      iara_chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          role: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      iara_data_sources: {
        Row: {
          categoria: string | null
          descricao: string | null
          id: string
          nome: string
          registros: number
          status: Database["public"]["Enums"]["iara_source_status"]
          ultima_sync: string | null
        }
        Insert: {
          categoria?: string | null
          descricao?: string | null
          id?: string
          nome: string
          registros?: number
          status?: Database["public"]["Enums"]["iara_source_status"]
          ultima_sync?: string | null
        }
        Update: {
          categoria?: string | null
          descricao?: string | null
          id?: string
          nome?: string
          registros?: number
          status?: Database["public"]["Enums"]["iara_source_status"]
          ultima_sync?: string | null
        }
        Relationships: []
      }
      iara_knowledge_base: {
        Row: {
          content: string
          created_at: string
          id: number
          ordem: number
          source: string
          title: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: number
          ordem?: number
          source: string
          title: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: number
          ordem?: number
          source?: string
          title?: string
        }
        Relationships: []
      }
      iara_processos_baixados: {
        Row: {
          ano_mes: number | null
          classe: string | null
          criminal: boolean | null
          dt_evento: string | null
          grau: string | null
          id: number
          id_classe: number | null
          id_grau: string | null
          id_orgao_julgador: number | null
          novo: boolean | null
          numero: string | null
          orgao_julgador: string | null
          procedimento: string | null
          sigilo: number | null
          sistema: string | null
        }
        Insert: {
          ano_mes?: number | null
          classe?: string | null
          criminal?: boolean | null
          dt_evento?: string | null
          grau?: string | null
          id?: number
          id_classe?: number | null
          id_grau?: string | null
          id_orgao_julgador?: number | null
          novo?: boolean | null
          numero?: string | null
          orgao_julgador?: string | null
          procedimento?: string | null
          sigilo?: number | null
          sistema?: string | null
        }
        Update: {
          ano_mes?: number | null
          classe?: string | null
          criminal?: boolean | null
          dt_evento?: string | null
          grau?: string | null
          id?: number
          id_classe?: number | null
          id_grau?: string | null
          id_orgao_julgador?: number | null
          novo?: boolean | null
          numero?: string | null
          orgao_julgador?: string | null
          procedimento?: string | null
          sigilo?: number | null
          sistema?: string | null
        }
        Relationships: []
      }
      iara_processos_novos: {
        Row: {
          ano_mes: number | null
          classe: string | null
          criminal: boolean | null
          dt_evento: string | null
          grau: string | null
          id: number
          id_classe: number | null
          id_grau: string | null
          id_orgao_julgador: number | null
          novo: boolean | null
          numero: string | null
          orgao_julgador: string | null
          procedimento: string | null
          sigilo: number | null
          sistema: string | null
        }
        Insert: {
          ano_mes?: number | null
          classe?: string | null
          criminal?: boolean | null
          dt_evento?: string | null
          grau?: string | null
          id?: number
          id_classe?: number | null
          id_grau?: string | null
          id_orgao_julgador?: number | null
          novo?: boolean | null
          numero?: string | null
          orgao_julgador?: string | null
          procedimento?: string | null
          sigilo?: number | null
          sistema?: string | null
        }
        Update: {
          ano_mes?: number | null
          classe?: string | null
          criminal?: boolean | null
          dt_evento?: string | null
          grau?: string | null
          id?: number
          id_classe?: number | null
          id_grau?: string | null
          id_orgao_julgador?: number | null
          novo?: boolean | null
          numero?: string | null
          orgao_julgador?: string | null
          procedimento?: string | null
          sigilo?: number | null
          sistema?: string | null
        }
        Relationships: []
      }
      iara_processos_recebidos: {
        Row: {
          anomes: number | null
          dt_evento: string | null
          grau: string | null
          id: number
          id_orgao_julgador: number | null
          numero: string | null
          orgao_julgador: string | null
        }
        Insert: {
          anomes?: number | null
          dt_evento?: string | null
          grau?: string | null
          id?: number
          id_orgao_julgador?: number | null
          numero?: string | null
          orgao_julgador?: string | null
        }
        Update: {
          anomes?: number | null
          dt_evento?: string | null
          grau?: string | null
          id?: number
          id_orgao_julgador?: number | null
          numero?: string | null
          orgao_julgador?: string | null
        }
        Relationships: []
      }
      iara_tcl_monthly: {
        Row: {
          anomes: number
          grau: string
          id: number
          id_orgao_julgador: number
          procedimento: string
          quantidade_baixados: number
          quantidade_baixados_12m: number
          quantidade_novos: number
          quantidade_novos_12m: number
          quantidade_pendentes: number | null
          quantidade_remetidos_ent: number
          quantidade_remetidos_ent_12m: number
          quantidade_remetidos_saida: number
          quantidade_remetidos_saida_12m: number
        }
        Insert: {
          anomes: number
          grau: string
          id?: number
          id_orgao_julgador: number
          procedimento: string
          quantidade_baixados?: number
          quantidade_baixados_12m?: number
          quantidade_novos?: number
          quantidade_novos_12m?: number
          quantidade_pendentes?: number | null
          quantidade_remetidos_ent?: number
          quantidade_remetidos_ent_12m?: number
          quantidade_remetidos_saida?: number
          quantidade_remetidos_saida_12m?: number
        }
        Update: {
          anomes?: number
          grau?: string
          id?: number
          id_orgao_julgador?: number
          procedimento?: string
          quantidade_baixados?: number
          quantidade_baixados_12m?: number
          quantidade_novos?: number
          quantidade_novos_12m?: number
          quantidade_pendentes?: number | null
          quantidade_remetidos_ent?: number
          quantidade_remetidos_ent_12m?: number
          quantidade_remetidos_saida?: number
          quantidade_remetidos_saida_12m?: number
        }
        Relationships: []
      }
      iara_violencia: {
        Row: {
          classe: string | null
          data_ajuizamento: string | null
          data_fim: string | null
          data_inicio: string | null
          dias: number | null
          id: number
          id_ultimo_oj: number | null
          numero_sigilo: string | null
          orgao_julgador: string | null
          sigla_grau: string | null
          valido: boolean | null
        }
        Insert: {
          classe?: string | null
          data_ajuizamento?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          dias?: number | null
          id?: number
          id_ultimo_oj?: number | null
          numero_sigilo?: string | null
          orgao_julgador?: string | null
          sigla_grau?: string | null
          valido?: boolean | null
        }
        Update: {
          classe?: string | null
          data_ajuizamento?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          dias?: number | null
          id?: number
          id_ultimo_oj?: number | null
          numero_sigilo?: string | null
          orgao_julgador?: string | null
          sigla_grau?: string | null
          valido?: boolean | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string
          id: string
          persona: Database["public"]["Enums"]["iara_persona"]
          unidade: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          full_name?: string
          id?: string
          persona?: Database["public"]["Enums"]["iara_persona"]
          unidade?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          persona?: Database["public"]["Enums"]["iara_persona"]
          unidade?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "magistrado" | "gestor" | "servidor"
      iara_alert_severity: "baixa" | "media" | "alta" | "critica"
      iara_persona: "magistrado" | "gestor" | "servidor"
      iara_source_status: "conectado" | "sincronizando" | "pendente" | "erro"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "magistrado", "gestor", "servidor"],
      iara_alert_severity: ["baixa", "media", "alta", "critica"],
      iara_persona: ["magistrado", "gestor", "servidor"],
      iara_source_status: ["conectado", "sincronizando", "pendente", "erro"],
    },
  },
} as const
