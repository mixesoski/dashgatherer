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
      coach_athlete_relationships: {
        Row: {
          athlete_id: string
          coach_id: string
          created_at: string | null
          id: string
          status: string | null
        }
        Insert: {
          athlete_id: string
          coach_id: string
          created_at?: string | null
          id?: string
          status?: string | null
        }
        Update: {
          athlete_id?: string
          coach_id?: string
          created_at?: string | null
          id?: string
          status?: string | null
        }
        Relationships: []
      }
      coach_athletes: {
        Row: {
          athlete_id: string | null
          coach_id: string | null
          created_at: string
          id: string
        }
        Insert: {
          athlete_id?: string | null
          coach_id?: string | null
          created_at?: string
          id?: string
        }
        Update: {
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
      sync_locks: {
        Row: {
          timestamp: string | null
          user_id: string
        }
        Insert: {
          timestamp?: string | null
          user_id: string
        }
        Update: {
          timestamp?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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

type PublicSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] &
        PublicSchema["Views"])
    ? (PublicSchema["Tables"] &
        PublicSchema["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof PublicSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
    ? PublicSchema["Enums"][PublicEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof PublicSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof PublicSchema["CompositeTypes"]
    ? PublicSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never
