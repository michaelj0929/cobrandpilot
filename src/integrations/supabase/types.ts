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
      brand_versions: {
        Row: {
          brand_id: string
          created_at: string
          diff_summary: string
          edited_via: string
          id: string
          snapshot: Json | null
          version: number
        }
        Insert: {
          brand_id: string
          created_at?: string
          diff_summary: string
          edited_via?: string
          id?: string
          snapshot?: Json | null
          version: number
        }
        Update: {
          brand_id?: string
          created_at?: string
          diff_summary?: string
          edited_via?: string
          id?: string
          snapshot?: Json | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "brand_versions_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      brands: {
        Row: {
          brand_type: string | null
          category: string | null
          created_at: string
          current_version: number
          description: string | null
          id: string
          name: string
          primary_market: string | null
          updated_at: string
        }
        Insert: {
          brand_type?: string | null
          category?: string | null
          created_at?: string
          current_version?: number
          description?: string | null
          id?: string
          name: string
          primary_market?: string | null
          updated_at?: string
        }
        Update: {
          brand_type?: string | null
          category?: string | null
          created_at?: string
          current_version?: number
          description?: string | null
          id?: string
          name?: string
          primary_market?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      context_tags: {
        Row: {
          audience: string | null
          brand_id: string
          campaign: string | null
          campaign_expires_at: string | null
          channel: string | null
          created_at: string
          format: string | null
          funnel_stage: string | null
          id: string
          language: string | null
          market: string | null
          objective: string | null
          product: string | null
          rule_id: string
        }
        Insert: {
          audience?: string | null
          brand_id: string
          campaign?: string | null
          campaign_expires_at?: string | null
          channel?: string | null
          created_at?: string
          format?: string | null
          funnel_stage?: string | null
          id?: string
          language?: string | null
          market?: string | null
          objective?: string | null
          product?: string | null
          rule_id: string
        }
        Update: {
          audience?: string | null
          brand_id?: string
          campaign?: string | null
          campaign_expires_at?: string | null
          channel?: string | null
          created_at?: string
          format?: string | null
          funnel_stage?: string | null
          id?: string
          language?: string | null
          market?: string | null
          objective?: string | null
          product?: string | null
          rule_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "context_tags_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "context_tags_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "rules"
            referencedColumns: ["id"]
          },
        ]
      }
      findings: {
        Row: {
          applies_because: string | null
          check_id: string
          confidence: string
          created_at: string
          dimension: string | null
          explanation: string
          id: string
          number: number
          pass_name: string
          pin_x: number | null
          pin_y: number | null
          quote: string | null
          rule_id: string | null
          rule_statement: string | null
          severity: string
          source_citation: string | null
          status: string
          suggested_fix: string | null
          title: string
          why_it_matters: string | null
        }
        Insert: {
          applies_because?: string | null
          check_id: string
          confidence?: string
          created_at?: string
          dimension?: string | null
          explanation: string
          id?: string
          number?: number
          pass_name?: string
          pin_x?: number | null
          pin_y?: number | null
          quote?: string | null
          rule_id?: string | null
          rule_statement?: string | null
          severity?: string
          source_citation?: string | null
          status?: string
          suggested_fix?: string | null
          title: string
          why_it_matters?: string | null
        }
        Update: {
          applies_because?: string | null
          check_id?: string
          confidence?: string
          created_at?: string
          dimension?: string | null
          explanation?: string
          id?: string
          number?: number
          pass_name?: string
          pin_x?: number | null
          pin_y?: number | null
          quote?: string | null
          rule_id?: string | null
          rule_statement?: string | null
          severity?: string
          source_citation?: string | null
          status?: string
          suggested_fix?: string | null
          title?: string
          why_it_matters?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "findings_check_id_fkey"
            columns: ["check_id"]
            isOneToOne: false
            referencedRelation: "validation_checks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "findings_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "rules"
            referencedColumns: ["id"]
          },
        ]
      }
      rule_examples: {
        Row: {
          brand_id: string
          created_at: string
          description: string
          example_type: string
          id: string
          rule_id: string | null
          source_ref: string | null
        }
        Insert: {
          brand_id: string
          created_at?: string
          description: string
          example_type?: string
          id?: string
          rule_id?: string | null
          source_ref?: string | null
        }
        Update: {
          brand_id?: string
          created_at?: string
          description?: string
          example_type?: string
          id?: string
          rule_id?: string | null
          source_ref?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rule_examples_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rule_examples_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "rules"
            referencedColumns: ["id"]
          },
        ]
      }
      rules: {
        Row: {
          authority: string | null
          brand_id: string
          confidence: string | null
          conflict_note: string | null
          created_at: string
          id: string
          label: string
          layer: string
          review_state: string
          rule_type: string
          scope: string
          severity: string
          source_citation: string | null
          source_evidence: string | null
          source_file_id: string | null
          statement: string | null
          status: string
          superseded_by: string | null
          time_scope: string
          updated_at: string
          value: Json
        }
        Insert: {
          authority?: string | null
          brand_id: string
          confidence?: string | null
          conflict_note?: string | null
          created_at?: string
          id?: string
          label: string
          layer?: string
          review_state?: string
          rule_type: string
          scope?: string
          severity?: string
          source_citation?: string | null
          source_evidence?: string | null
          source_file_id?: string | null
          statement?: string | null
          status?: string
          superseded_by?: string | null
          time_scope?: string
          updated_at?: string
          value?: Json
        }
        Update: {
          authority?: string | null
          brand_id?: string
          confidence?: string | null
          conflict_note?: string | null
          created_at?: string
          id?: string
          label?: string
          layer?: string
          review_state?: string
          rule_type?: string
          scope?: string
          severity?: string
          source_citation?: string | null
          source_evidence?: string | null
          source_file_id?: string | null
          statement?: string | null
          status?: string
          superseded_by?: string | null
          time_scope?: string
          updated_at?: string
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "rules_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rules_source_file_id_fkey"
            columns: ["source_file_id"]
            isOneToOne: false
            referencedRelation: "source_files"
            referencedColumns: ["id"]
          },
        ]
      }
      setup_gaps: {
        Row: {
          brand_id: string
          created_at: string
          gap_type: string
          id: string
          layer: string | null
          resolved: boolean
          source_note: string | null
          topic: string
          updated_at: string
          why_it_matters: string | null
        }
        Insert: {
          brand_id: string
          created_at?: string
          gap_type?: string
          id?: string
          layer?: string | null
          resolved?: boolean
          source_note?: string | null
          topic: string
          updated_at?: string
          why_it_matters?: string | null
        }
        Update: {
          brand_id?: string
          created_at?: string
          gap_type?: string
          id?: string
          layer?: string | null
          resolved?: boolean
          source_note?: string | null
          topic?: string
          updated_at?: string
          why_it_matters?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "setup_gaps_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      source_files: {
        Row: {
          brand_id: string
          classification: string | null
          classification_rationale: string | null
          created_at: string
          error: string | null
          file_name: string
          id: string
          kind: string
          mime_type: string | null
          pasted_text: string | null
          rules_extracted: number
          status: string
          storage_path: string | null
          suggested_classification: string | null
          updated_at: string
        }
        Insert: {
          brand_id: string
          classification?: string | null
          classification_rationale?: string | null
          created_at?: string
          error?: string | null
          file_name: string
          id?: string
          kind?: string
          mime_type?: string | null
          pasted_text?: string | null
          rules_extracted?: number
          status?: string
          storage_path?: string | null
          suggested_classification?: string | null
          updated_at?: string
        }
        Update: {
          brand_id?: string
          classification?: string | null
          classification_rationale?: string | null
          created_at?: string
          error?: string | null
          file_name?: string
          id?: string
          kind?: string
          mime_type?: string | null
          pasted_text?: string | null
          rules_extracted?: number
          status?: string
          storage_path?: string | null
          suggested_classification?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "source_files_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      validation_checks: {
        Row: {
          applied_rules: Json | null
          asset_mime: string | null
          asset_name: string | null
          asset_path: string | null
          brand_id: string
          brand_model_version: number
          brief_text: string | null
          copy_text: string | null
          created_at: string
          creative_context: Json
          dimension_scores: Json | null
          error: string | null
          id: string
          input_type: string
          label: string | null
          readiness: Json | null
          score: number | null
          status: string
          summary: string | null
          updated_at: string
        }
        Insert: {
          applied_rules?: Json | null
          asset_mime?: string | null
          asset_name?: string | null
          asset_path?: string | null
          brand_id: string
          brand_model_version?: number
          brief_text?: string | null
          copy_text?: string | null
          created_at?: string
          creative_context?: Json
          dimension_scores?: Json | null
          error?: string | null
          id?: string
          input_type?: string
          label?: string | null
          readiness?: Json | null
          score?: number | null
          status?: string
          summary?: string | null
          updated_at?: string
        }
        Update: {
          applied_rules?: Json | null
          asset_mime?: string | null
          asset_name?: string | null
          asset_path?: string | null
          brand_id?: string
          brand_model_version?: number
          brief_text?: string | null
          copy_text?: string | null
          created_at?: string
          creative_context?: Json
          dimension_scores?: Json | null
          error?: string | null
          id?: string
          input_type?: string
          label?: string | null
          readiness?: Json | null
          score?: number | null
          status?: string
          summary?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "validation_checks_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
