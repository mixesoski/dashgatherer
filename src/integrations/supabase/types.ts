export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      coach_athletes: {
        Row: {
          athlete_email: string
          athlete_id: string | null
          coach_id: string | null
          created_at: string
          id: string
        }
        Insert: {
          athlete_email: string
          athlete_id?: string | null
          coach_id?: string | null
          created_at?: string
          id?: string
        }
        Update: {
          athlete_email?: string
          athlete_id?: string | null
          coach_id?: string | null
          created_at?: string
          id?: string
        }
        Relationships: []
      }
      coach_invitations: {
        Row: {
          athlete_id: string
          coach_email: string
          created_at: string
          id: string
          status: Database["public"]["Enums"]["coach_invitation_status"] | null
          updated_at: string
        }
        Insert: {
          athlete_id: string
          coach_email: string
          created_at?: string
          id?: string
          status?: Database["public"]["Enums"]["coach_invitation_status"] | null
          updated_at?: string
        }
        Update: {
          athlete_id?: string
          coach_email?: string
          created_at?: string
          id?: string
          status?: Database["public"]["Enums"]["coach_invitation_status"] | null
          updated_at?: string
        }
        Relationships: []
      }
      garmin_credentials: {
        Row: {
          created_at: string
          email: string
          id: string
          password: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          password: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          password?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      garmin_data: {
        Row: {
          activity: string
          atl: number | null
          created_at: string | null
          ctl: number | null
          date: string
          id: string
          trimp: number
          tsb: number | null
          user_id: string
        }
        Insert: {
          activity: string
          atl?: number | null
          created_at?: string | null
          ctl?: number | null
          date: string
          id?: string
          trimp: number
          tsb?: number | null
          user_id: string
        }
        Update: {
          activity?: string
          atl?: number | null
          created_at?: string | null
          ctl?: number | null
          date?: string
          id?: string
          trimp?: number
          tsb?: number | null
          user_id?: string
        }
        Relationships: []
      }
      manual_data: {
        Row: {
          activity_name: string | null
          created_at: string
          date: string | null
          id: number
          trimp: number | null
          user_id: string | null
        }
        Insert: {
          activity_name?: string | null
          created_at?: string
          date?: string | null
          id?: number
          trimp?: number | null
          user_id?: string | null
        }
        Update: {
          activity_name?: string | null
          created_at?: string
          date?: string | null
          id?: number
          trimp?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          garmin_email: string | null
          garmin_password: string | null
          id: number
          nickname: string | null
          role: Database["public"]["Enums"]["user_role"] | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          garmin_email?: string | null
          garmin_password?: string | null
          id?: number
          nickname?: string | null
          role?: Database["public"]["Enums"]["user_role"] | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          garmin_email?: string | null
          garmin_password?: string | null
          id?: number
          nickname?: string | null
          role?: Database["public"]["Enums"]["user_role"] | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          created_at: string
          id: string
          plan_id: string
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          plan_id: string
          status: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          plan_id?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      sync_locks: {
        Row: {
          id: string
          timestamp: string
          user_id: string
        }
        Insert: {
          id?: string
          timestamp?: string
          user_id: string
        }
        Update: {
          id?: string
          timestamp?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_email: {
        Args: { user_id: string }
        Returns: string
      }
      update_garmin_credentials: {
        Args: {
          p_user_id: string
          p_garmin_email: string
          p_garmin_password: string
        }
        Returns: undefined
      }
      update_garmin_credentials_both: {
        Args: {
          p_user_id: string
          p_garmin_email: string
          p_garmin_password: string
        }
        Returns: undefined
      }
    }
    Enums: {
      coach_invitation_status: "pending" | "accepted" | "rejected"
      user_role: "athlete" | "coach"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      coach_invitation_status: ["pending", "accepted", "rejected"],
      user_role: ["athlete", "coach"],
    },
  },
} as const
