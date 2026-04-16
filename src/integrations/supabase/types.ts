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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      auction_organizations: {
        Row: {
          address: string | null
          created_at: string
          email: string | null
          id: string
          logo_url: string | null
          name: string
          phone: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          logo_url?: string | null
          name: string
          phone?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          phone?: string | null
        }
        Relationships: []
      }
      listing_contacts: {
        Row: {
          contact_info: Json
          created_at: string
          id: string
          listing_id: string
          updated_at: string
        }
        Insert: {
          contact_info: Json
          created_at?: string
          id?: string
          listing_id: string
          updated_at?: string
        }
        Update: {
          contact_info?: Json
          created_at?: string
          id?: string
          listing_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_contacts_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: true
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      listings: {
        Row: {
          access_road_width: number | null
          address: Json | null
          alley_width: number | null
          apartment_floor_info: string | null
          area: number
          attributes: Json | null
          auction_org_id: string | null
          balcony_direction: string | null
          building_name: string | null
          ceiling_height: number | null
          coordinates: Json | null
          created_at: string
          custom_attributes: Json | null
          depth: number | null
          description: string | null
          existing_structures: string | null
          expected_move_in_date: string | null
          facade_width: number | null
          featured: boolean | null
          fire_protection: boolean | null
          floor_load: number | null
          floor_number: number | null
          house_direction: string | null
          id: string
          image_url: string | null
          infrastructure: string | null
          interior_status: string | null
          land_direction: string | null
          land_type: string | null
          legal_status: string | null
          num_bathrooms: number | null
          num_bedrooms: number | null
          num_floors: number | null
          organization_id: string | null
          planning_info: string | null
          price: number
          price_unit: Database["public"]["Enums"]["price_unit"]
          project_name: string | null
          prominent_features: string[] | null
          property_type_slug: string
          purpose: string
          service_costs: number | null
          status: Database["public"]["Enums"]["listing_status"]
          title: string
          transport_access: string | null
          updated_at: string
          user_id: string | null
          verified: boolean | null
          views_count: number | null
        }
        Insert: {
          access_road_width?: number | null
          address?: Json | null
          alley_width?: number | null
          apartment_floor_info?: string | null
          area: number
          attributes?: Json | null
          auction_org_id?: string | null
          balcony_direction?: string | null
          building_name?: string | null
          ceiling_height?: number | null
          coordinates?: Json | null
          created_at?: string
          custom_attributes?: Json | null
          depth?: number | null
          description?: string | null
          existing_structures?: string | null
          expected_move_in_date?: string | null
          facade_width?: number | null
          featured?: boolean | null
          fire_protection?: boolean | null
          floor_load?: number | null
          floor_number?: number | null
          house_direction?: string | null
          id?: string
          image_url?: string | null
          infrastructure?: string | null
          interior_status?: string | null
          land_direction?: string | null
          land_type?: string | null
          legal_status?: string | null
          num_bathrooms?: number | null
          num_bedrooms?: number | null
          num_floors?: number | null
          organization_id?: string | null
          planning_info?: string | null
          price: number
          price_unit?: Database["public"]["Enums"]["price_unit"]
          project_name?: string | null
          prominent_features?: string[] | null
          property_type_slug: string
          purpose: string
          service_costs?: number | null
          status?: Database["public"]["Enums"]["listing_status"]
          title: string
          transport_access?: string | null
          updated_at?: string
          user_id?: string | null
          verified?: boolean | null
          views_count?: number | null
        }
        Update: {
          access_road_width?: number | null
          address?: Json | null
          alley_width?: number | null
          apartment_floor_info?: string | null
          area?: number
          attributes?: Json | null
          auction_org_id?: string | null
          balcony_direction?: string | null
          building_name?: string | null
          ceiling_height?: number | null
          coordinates?: Json | null
          created_at?: string
          custom_attributes?: Json | null
          depth?: number | null
          description?: string | null
          existing_structures?: string | null
          expected_move_in_date?: string | null
          facade_width?: number | null
          featured?: boolean | null
          fire_protection?: boolean | null
          floor_load?: number | null
          floor_number?: number | null
          house_direction?: string | null
          id?: string
          image_url?: string | null
          infrastructure?: string | null
          interior_status?: string | null
          land_direction?: string | null
          land_type?: string | null
          legal_status?: string | null
          num_bathrooms?: number | null
          num_bedrooms?: number | null
          num_floors?: number | null
          organization_id?: string | null
          planning_info?: string | null
          price?: number
          price_unit?: Database["public"]["Enums"]["price_unit"]
          project_name?: string | null
          prominent_features?: string[] | null
          property_type_slug?: string
          purpose?: string
          service_costs?: number | null
          status?: Database["public"]["Enums"]["listing_status"]
          title?: string
          transport_access?: string | null
          updated_at?: string
          user_id?: string | null
          verified?: boolean | null
          views_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "listings_auction_org_id_fkey"
            columns: ["auction_org_id"]
            isOneToOne: false
            referencedRelation: "auction_organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_memberships: {
        Row: {
          created_at: string
          id: string
          invite_email: string | null
          invite_token: string | null
          invited_by: string | null
          joined_at: string | null
          organization_id: string
          role_id: string
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          invite_email?: string | null
          invite_token?: string | null
          invited_by?: string | null
          joined_at?: string | null
          organization_id: string
          role_id: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          invite_email?: string | null
          invite_token?: string | null
          invited_by?: string | null
          joined_at?: string | null
          organization_id?: string
          role_id?: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_memberships_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_memberships_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_memberships_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "organization_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_roles: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          permissions: Json
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          permissions?: Json
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          permissions?: Json
        }
        Relationships: []
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          kyc_status: Database["public"]["Enums"]["kyc_status"]
          license_info: Json | null
          name: string
          owner_id: string
          rejection_reason: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          kyc_status?: Database["public"]["Enums"]["kyc_status"]
          license_info?: Json | null
          name: string
          owner_id: string
          rejection_reason?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          kyc_status?: Database["public"]["Enums"]["kyc_status"]
          license_info?: Json | null
          name?: string
          owner_id?: string
          rejection_reason?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organizations_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          agent_info: Json | null
          created_at: string
          email: string
          id: string
          kyc_status: Database["public"]["Enums"]["kyc_status"]
          name: string | null
          notifications_enabled: boolean
          rejection_reason: string | null
          updated_at: string
        }
        Insert: {
          agent_info?: Json | null
          created_at?: string
          email: string
          id: string
          kyc_status?: Database["public"]["Enums"]["kyc_status"]
          name?: string | null
          notifications_enabled?: boolean
          rejection_reason?: string | null
          updated_at?: string
        }
        Update: {
          agent_info?: Json | null
          created_at?: string
          email?: string
          id?: string
          kyc_status?: Database["public"]["Enums"]["kyc_status"]
          name?: string | null
          notifications_enabled?: boolean
          rejection_reason?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      property_types: {
        Row: {
          created_at: string
          filter_metadata: Json
          id: string
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          filter_metadata?: Json
          id?: string
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          filter_metadata?: Json
          id?: string
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_asset_actions: {
        Row: {
          created_at: string
          id: string
          is_following: boolean
          is_saved: boolean
          listing_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_following?: boolean
          is_saved?: boolean
          listing_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_following?: boolean
          is_saved?: boolean
          listing_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_email_exists: { Args: { _email: string }; Returns: boolean }
      get_listing_save_counts: {
        Args: { listing_ids: string[] }
        Returns: {
          listing_id: string
          save_count: number
        }[]
      }
      get_user_email: { Args: { _user_id: string }; Returns: string }
      has_org_role: {
        Args: { _org_id: string; _role_names: string[]; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_org_member: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      users_share_org: {
        Args: { _user1_id: string; _user2_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "USER" | "ADMIN"
      kyc_status: "NOT_APPLIED" | "PENDING_KYC" | "APPROVED" | "REJECTED"
      listing_status:
        | "DRAFT"
        | "PENDING_APPROVAL"
        | "ACTIVE"
        | "INACTIVE"
        | "SOLD_RENTED"
      price_unit: "TOTAL" | "PER_SQM" | "PER_MONTH"
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
      app_role: ["USER", "ADMIN"],
      kyc_status: ["NOT_APPLIED", "PENDING_KYC", "APPROVED", "REJECTED"],
      listing_status: [
        "DRAFT",
        "PENDING_APPROVAL",
        "ACTIVE",
        "INACTIVE",
        "SOLD_RENTED",
      ],
      price_unit: ["TOTAL", "PER_SQM", "PER_MONTH"],
    },
  },
} as const
