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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      app_notifications: {
        Row: {
          created_at: string
          data: Json | null
          id: string
          message: string | null
          read: boolean | null
          title: string
          type: string | null
        }
        Insert: {
          created_at?: string
          data?: Json | null
          id?: string
          message?: string | null
          read?: boolean | null
          title: string
          type?: string | null
        }
        Update: {
          created_at?: string
          data?: Json | null
          id?: string
          message?: string | null
          read?: boolean | null
          title?: string
          type?: string | null
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          emoji: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          emoji?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          emoji?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      employee_permissions: {
        Row: {
          can_entry: boolean
          can_output: boolean
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          can_entry?: boolean
          can_output?: boolean
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          can_entry?: boolean
          can_output?: boolean
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      event_menu_dish_items: {
        Row: {
          calculated_quantity: number
          created_at: string
          id: string
          item_id: string
          menu_dish_id: string
          override_quantity: number | null
          unit: string | null
        }
        Insert: {
          calculated_quantity?: number
          created_at?: string
          id?: string
          item_id: string
          menu_dish_id: string
          override_quantity?: number | null
          unit?: string | null
        }
        Update: {
          calculated_quantity?: number
          created_at?: string
          id?: string
          item_id?: string
          menu_dish_id?: string
          override_quantity?: number | null
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_menu_dish_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "stock_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_menu_dish_items_menu_dish_id_fkey"
            columns: ["menu_dish_id"]
            isOneToOne: false
            referencedRelation: "event_menu_dishes"
            referencedColumns: ["id"]
          },
        ]
      }
      event_menu_dishes: {
        Row: {
          created_at: string
          id: string
          menu_id: string
          notes: string | null
          planned_quantity: number
          planned_unit: string | null
          sheet_id: string
          sort_order: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          menu_id: string
          notes?: string | null
          planned_quantity?: number
          planned_unit?: string | null
          sheet_id: string
          sort_order?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          menu_id?: string
          notes?: string | null
          planned_quantity?: number
          planned_unit?: string | null
          sheet_id?: string
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "event_menu_dishes_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "event_menus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_menu_dishes_sheet_id_fkey"
            columns: ["sheet_id"]
            isOneToOne: false
            referencedRelation: "technical_sheets"
            referencedColumns: ["id"]
          },
        ]
      }
      event_menus: {
        Row: {
          created_at: string
          event_date: string | null
          guest_count: number
          id: string
          location: string | null
          name: string
          notes: string | null
          staff_count: number | null
          status: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          event_date?: string | null
          guest_count?: number
          id?: string
          location?: string | null
          name: string
          notes?: string | null
          staff_count?: number | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          event_date?: string | null
          guest_count?: number
          id?: string
          location?: string | null
          name?: string
          notes?: string | null
          staff_count?: number | null
          status?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      inventory_count_items: {
        Row: {
          count_id: string
          counted_stock: number | null
          created_at: string
          difference: number | null
          id: string
          item_id: string
          system_stock: number
        }
        Insert: {
          count_id: string
          counted_stock?: number | null
          created_at?: string
          difference?: number | null
          id?: string
          item_id: string
          system_stock?: number
        }
        Update: {
          count_id?: string
          counted_stock?: number | null
          created_at?: string
          difference?: number | null
          id?: string
          item_id?: string
          system_stock?: number
        }
        Relationships: [
          {
            foreignKeyName: "inventory_count_items_count_id_fkey"
            columns: ["count_id"]
            isOneToOne: false
            referencedRelation: "inventory_counts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_count_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "stock_items"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_counts: {
        Row: {
          completed_at: string | null
          counted_by: string | null
          created_at: string
          date: string
          id: string
          kitchen_id: string | null
          notes: string | null
          status: string
        }
        Insert: {
          completed_at?: string | null
          counted_by?: string | null
          created_at?: string
          date?: string
          id?: string
          kitchen_id?: string | null
          notes?: string | null
          status?: string
        }
        Update: {
          completed_at?: string | null
          counted_by?: string | null
          created_at?: string
          date?: string
          id?: string
          kitchen_id?: string | null
          notes?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_counts_kitchen_id_fkey"
            columns: ["kitchen_id"]
            isOneToOne: false
            referencedRelation: "kitchens"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_tokens: {
        Row: {
          count_id: string | null
          created_at: string
          expires_at: string
          id: string
          kitchen_id: string | null
          token: string
        }
        Insert: {
          count_id?: string | null
          created_at?: string
          expires_at: string
          id?: string
          kitchen_id?: string | null
          token?: string
        }
        Update: {
          count_id?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          kitchen_id?: string | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_tokens_count_id_fkey"
            columns: ["count_id"]
            isOneToOne: false
            referencedRelation: "inventory_counts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_tokens_kitchen_id_fkey"
            columns: ["kitchen_id"]
            isOneToOne: false
            referencedRelation: "kitchens"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_items: {
        Row: {
          created_at: string
          id: string
          invoice_id: string
          nf_description: string | null
          nf_quantity: number | null
          nf_unit: string | null
          nf_unit_price: number | null
          previous_unit_cost: number | null
          status: string | null
          stock_item_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          invoice_id: string
          nf_description?: string | null
          nf_quantity?: number | null
          nf_unit?: string | null
          nf_unit_price?: number | null
          previous_unit_cost?: number | null
          status?: string | null
          stock_item_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          invoice_id?: string
          nf_description?: string | null
          nf_quantity?: number | null
          nf_unit?: string | null
          nf_unit_price?: number | null
          previous_unit_cost?: number | null
          status?: string | null
          stock_item_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "stock_items"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          created_at: string
          file_type: string | null
          file_url: string | null
          id: string
          issue_date: string | null
          number: string | null
          registered_by: string | null
          series: string | null
          status: string | null
          supplier_cnpj: string | null
          supplier_name: string | null
          total_value: number | null
        }
        Insert: {
          created_at?: string
          file_type?: string | null
          file_url?: string | null
          id?: string
          issue_date?: string | null
          number?: string | null
          registered_by?: string | null
          series?: string | null
          status?: string | null
          supplier_cnpj?: string | null
          supplier_name?: string | null
          total_value?: number | null
        }
        Update: {
          created_at?: string
          file_type?: string | null
          file_url?: string | null
          id?: string
          issue_date?: string | null
          number?: string | null
          registered_by?: string | null
          series?: string | null
          status?: string | null
          supplier_cnpj?: string | null
          supplier_name?: string | null
          total_value?: number | null
        }
        Relationships: []
      }
      kitchens: {
        Row: {
          created_at: string
          id: string
          is_default: boolean
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_default?: boolean
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string
          email: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string
          email?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string
          email?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      sheet_categories: {
        Row: {
          created_at: string
          id: string
          name: string
          sort_order: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          sort_order?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          sort_order?: number | null
        }
        Relationships: []
      }
      stock_entries: {
        Row: {
          created_at: string
          date: string
          id: string
          invoice_number: string | null
          item_id: string
          kitchen_id: string | null
          notes: string | null
          quantity: number
          registered_by: string
          supplier: string | null
          unit_cost: number | null
        }
        Insert: {
          created_at?: string
          date?: string
          id?: string
          invoice_number?: string | null
          item_id: string
          kitchen_id?: string | null
          notes?: string | null
          quantity: number
          registered_by: string
          supplier?: string | null
          unit_cost?: number | null
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          invoice_number?: string | null
          item_id?: string
          kitchen_id?: string | null
          notes?: string | null
          quantity?: number
          registered_by?: string
          supplier?: string | null
          unit_cost?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_entries_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "stock_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_entries_kitchen_id_fkey"
            columns: ["kitchen_id"]
            isOneToOne: false
            referencedRelation: "kitchens"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_item_locations: {
        Row: {
          created_at: string
          current_stock: number
          id: string
          item_id: string
          kitchen_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_stock?: number
          id?: string
          item_id: string
          kitchen_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_stock?: number
          id?: string
          item_id?: string
          kitchen_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_item_locations_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "stock_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_item_locations_kitchen_id_fkey"
            columns: ["kitchen_id"]
            isOneToOne: false
            referencedRelation: "kitchens"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_items: {
        Row: {
          barcode: string | null
          category: string
          created_at: string
          current_stock: number
          id: string
          image_url: string | null
          min_stock: number
          name: string
          unit: string
          unit_cost: number
          updated_at: string
        }
        Insert: {
          barcode?: string | null
          category: string
          created_at?: string
          current_stock?: number
          id?: string
          image_url?: string | null
          min_stock?: number
          name: string
          unit: string
          unit_cost?: number
          updated_at?: string
        }
        Update: {
          barcode?: string | null
          category?: string
          created_at?: string
          current_stock?: number
          id?: string
          image_url?: string | null
          min_stock?: number
          name?: string
          unit?: string
          unit_cost?: number
          updated_at?: string
        }
        Relationships: []
      }
      stock_outputs: {
        Row: {
          created_at: string
          date: string
          employee_name: string
          event_name: string | null
          id: string
          item_id: string
          kitchen_id: string | null
          notes: string | null
          quantity: number
          registered_by: string
        }
        Insert: {
          created_at?: string
          date?: string
          employee_name: string
          event_name?: string | null
          id?: string
          item_id: string
          kitchen_id?: string | null
          notes?: string | null
          quantity: number
          registered_by: string
        }
        Update: {
          created_at?: string
          date?: string
          employee_name?: string
          event_name?: string | null
          id?: string
          item_id?: string
          kitchen_id?: string | null
          notes?: string | null
          quantity?: number
          registered_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_outputs_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "stock_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_outputs_kitchen_id_fkey"
            columns: ["kitchen_id"]
            isOneToOne: false
            referencedRelation: "kitchens"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_price_history: {
        Row: {
          changed_by: string | null
          created_at: string
          id: string
          item_id: string
          new_price: number
          old_price: number
          source: string | null
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          id?: string
          item_id: string
          new_price?: number
          old_price?: number
          source?: string | null
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          id?: string
          item_id?: string
          new_price?: number
          old_price?: number
          source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_price_history_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "stock_items"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_transfers: {
        Row: {
          created_at: string
          date: string
          from_kitchen_id: string
          id: string
          item_id: string
          notes: string | null
          quantity: number
          to_kitchen_id: string
          transferred_by: string
        }
        Insert: {
          created_at?: string
          date?: string
          from_kitchen_id: string
          id?: string
          item_id: string
          notes?: string | null
          quantity: number
          to_kitchen_id: string
          transferred_by: string
        }
        Update: {
          created_at?: string
          date?: string
          from_kitchen_id?: string
          id?: string
          item_id?: string
          notes?: string | null
          quantity?: number
          to_kitchen_id?: string
          transferred_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_transfers_from_kitchen_id_fkey"
            columns: ["from_kitchen_id"]
            isOneToOne: false
            referencedRelation: "kitchens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfers_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "stock_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfers_to_kitchen_id_fkey"
            columns: ["to_kitchen_id"]
            isOneToOne: false
            referencedRelation: "kitchens"
            referencedColumns: ["id"]
          },
        ]
      }
      technical_sheet_items: {
        Row: {
          correction_factor: number | null
          gross_quantity: number | null
          id: string
          item_id: string
          quantity: number
          sheet_id: string
          unit_cost: number | null
        }
        Insert: {
          correction_factor?: number | null
          gross_quantity?: number | null
          id?: string
          item_id: string
          quantity: number
          sheet_id: string
          unit_cost?: number | null
        }
        Update: {
          correction_factor?: number | null
          gross_quantity?: number | null
          id?: string
          item_id?: string
          quantity?: number
          sheet_id?: string
          unit_cost?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "technical_sheet_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "stock_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technical_sheet_items_sheet_id_fkey"
            columns: ["sheet_id"]
            isOneToOne: false
            referencedRelation: "technical_sheets"
            referencedColumns: ["id"]
          },
        ]
      }
      technical_sheets: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          id: string
          instructions: string | null
          name: string
          prep_time: number | null
          servings: number
          updated_at: string
          yield_quantity: number | null
          yield_unit: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          instructions?: string | null
          name: string
          prep_time?: number | null
          servings?: number
          updated_at?: string
          yield_quantity?: number | null
          yield_unit?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          instructions?: string | null
          name?: string
          prep_time?: number | null
          servings?: number
          updated_at?: string
          yield_quantity?: number | null
          yield_unit?: string | null
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
      app_role: "supervisor" | "employee"
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
      app_role: ["supervisor", "employee"],
    },
  },
} as const
