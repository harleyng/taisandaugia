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
      article_categories: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
          slug: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
          slug: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      articles: {
        Row: {
          author_id: string | null
          category_id: string | null
          content: string | null
          created_at: string
          excerpt: string | null
          featured_image_url: string | null
          homepage_position: number | null
          id: string
          published_at: string | null
          read_time_minutes: number | null
          show_on_homepage: boolean
          slug: string
          source_name: string | null
          source_type: string
          source_url: string | null
          status: string
          title: string
          updated_at: string
          view_count: number
        }
        Insert: {
          author_id?: string | null
          category_id?: string | null
          content?: string | null
          created_at?: string
          excerpt?: string | null
          featured_image_url?: string | null
          homepage_position?: number | null
          id?: string
          published_at?: string | null
          read_time_minutes?: number | null
          show_on_homepage?: boolean
          slug: string
          source_name?: string | null
          source_type?: string
          source_url?: string | null
          status?: string
          title: string
          updated_at?: string
          view_count?: number
        }
        Update: {
          author_id?: string | null
          category_id?: string | null
          content?: string | null
          created_at?: string
          excerpt?: string | null
          featured_image_url?: string | null
          homepage_position?: number | null
          id?: string
          published_at?: string | null
          read_time_minutes?: number | null
          show_on_homepage?: boolean
          slug?: string
          source_name?: string | null
          source_type?: string
          source_url?: string | null
          status?: string
          title?: string
          updated_at?: string
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "articles_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "article_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_owner_claims: {
        Row: {
          asset_owner_id: string | null
          confidence_score: number | null
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          id: string
          listing_id: string | null
          match_basis: string | null
          matched_name: string | null
          rejection_reason: string | null
          status: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          asset_owner_id?: string | null
          confidence_score?: number | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          id?: string
          listing_id?: string | null
          match_basis?: string | null
          matched_name?: string | null
          rejection_reason?: string | null
          status?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          asset_owner_id?: string | null
          confidence_score?: number | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          id?: string
          listing_id?: string | null
          match_basis?: string | null
          matched_name?: string | null
          rejection_reason?: string | null
          status?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_owner_claims_asset_owner_id_fkey"
            columns: ["asset_owner_id"]
            isOneToOne: false
            referencedRelation: "asset_owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_owner_claims_confirmed_by_fkey"
            columns: ["confirmed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_owner_claims_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_owner_claims_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "asset_owner_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_owner_kyc: {
        Row: {
          contact_email: string | null
          created_at: string
          full_name: string | null
          id: string
          id_back_url: string | null
          id_front_url: string | null
          id_number: string | null
          id_type: string | null
          phone: string | null
          phone_verified: boolean
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          selfie_url: string | null
          status: string
          submitted_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          contact_email?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          id_back_url?: string | null
          id_front_url?: string | null
          id_number?: string | null
          id_type?: string | null
          phone?: string | null
          phone_verified?: boolean
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          selfie_url?: string | null
          status?: string
          submitted_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          contact_email?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          id_back_url?: string | null
          id_front_url?: string | null
          id_number?: string | null
          id_type?: string | null
          phone?: string | null
          phone_verified?: boolean
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          selfie_url?: string | null
          status?: string
          submitted_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_owner_kyc_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_owner_kyc_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_owner_kyc_events: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          data: Json | null
          entity_id: string
          entity_type: string
          id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          data?: Json | null
          entity_id: string
          entity_type: string
          id?: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          data?: Json | null
          entity_id?: string
          entity_type?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_owner_kyc_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_owner_org_kyc: {
        Row: {
          authorization_doc_url: string | null
          created_at: string
          created_by: string
          email_domain: string | null
          establishment_doc_url: string | null
          id: string
          linked_auction_org_id: string | null
          official_email: string | null
          org_name: string | null
          org_type: string | null
          registry_match_data: Json | null
          registry_match_score: number | null
          rejection_reason: string | null
          rep_full_name: string | null
          rep_id_back_url: string | null
          rep_id_front_url: string | null
          rep_id_number: string | null
          rep_id_type: string | null
          rep_selfie_url: string | null
          rep_title: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          submitted_at: string | null
          tax_code: string | null
          updated_at: string
        }
        Insert: {
          authorization_doc_url?: string | null
          created_at?: string
          created_by: string
          email_domain?: string | null
          establishment_doc_url?: string | null
          id?: string
          linked_auction_org_id?: string | null
          official_email?: string | null
          org_name?: string | null
          org_type?: string | null
          registry_match_data?: Json | null
          registry_match_score?: number | null
          rejection_reason?: string | null
          rep_full_name?: string | null
          rep_id_back_url?: string | null
          rep_id_front_url?: string | null
          rep_id_number?: string | null
          rep_id_type?: string | null
          rep_selfie_url?: string | null
          rep_title?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_at?: string | null
          tax_code?: string | null
          updated_at?: string
        }
        Update: {
          authorization_doc_url?: string | null
          created_at?: string
          created_by?: string
          email_domain?: string | null
          establishment_doc_url?: string | null
          id?: string
          linked_auction_org_id?: string | null
          official_email?: string | null
          org_name?: string | null
          org_type?: string | null
          registry_match_data?: Json | null
          registry_match_score?: number | null
          rejection_reason?: string | null
          rep_full_name?: string | null
          rep_id_back_url?: string | null
          rep_id_front_url?: string | null
          rep_id_number?: string | null
          rep_id_type?: string | null
          rep_selfie_url?: string | null
          rep_title?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_at?: string | null
          tax_code?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_owner_org_kyc_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_owner_org_kyc_linked_auction_org_id_fkey"
            columns: ["linked_auction_org_id"]
            isOneToOne: false
            referencedRelation: "auction_organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_owner_org_kyc_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_owner_workspaces: {
        Row: {
          abbreviations: string[]
          branch_names: string[]
          created_at: string
          id: string
          last_matched_at: string | null
          org_kyc_id: string
          owner_user_id: string
          primary_name: string
          total_claimed: number
          updated_at: string
        }
        Insert: {
          abbreviations?: string[]
          branch_names?: string[]
          created_at?: string
          id?: string
          last_matched_at?: string | null
          org_kyc_id: string
          owner_user_id: string
          primary_name: string
          total_claimed?: number
          updated_at?: string
        }
        Update: {
          abbreviations?: string[]
          branch_names?: string[]
          created_at?: string
          id?: string
          last_matched_at?: string | null
          org_kyc_id?: string
          owner_user_id?: string
          primary_name?: string
          total_claimed?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_owner_workspaces_org_kyc_id_fkey"
            columns: ["org_kyc_id"]
            isOneToOne: true
            referencedRelation: "asset_owner_org_kyc"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_owner_workspaces_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_owners: {
        Row: {
          address: string | null
          created_at: string
          id: string
          name: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          address?: string | null
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      asset_postings: {
        Row: {
          address: string | null
          auction_format: string
          child_slug: string
          chosen_org_id: string | null
          commission_pct: number | null
          created_at: string
          delta_fields: Json
          description: string | null
          district: string | null
          doc_urls: string[]
          expected_timeline: string | null
          has_dispute: boolean | null
          has_mortgage: boolean | null
          id: string
          image_urls: string[]
          is_seized: boolean | null
          legal_notes: string | null
          ownership_proof_urls: string[]
          parent_slug: string
          pricing_mode: string
          province: string | null
          right_to_sell: boolean
          starting_price: number | null
          status: string
          submitted_at: string | null
          title: string
          updated_at: string
          user_id: string
          ward: string | null
        }
        Insert: {
          address?: string | null
          auction_format?: string
          child_slug: string
          chosen_org_id?: string | null
          commission_pct?: number | null
          created_at?: string
          delta_fields?: Json
          description?: string | null
          district?: string | null
          doc_urls?: string[]
          expected_timeline?: string | null
          has_dispute?: boolean | null
          has_mortgage?: boolean | null
          id?: string
          image_urls?: string[]
          is_seized?: boolean | null
          legal_notes?: string | null
          ownership_proof_urls?: string[]
          parent_slug: string
          pricing_mode?: string
          province?: string | null
          right_to_sell?: boolean
          starting_price?: number | null
          status?: string
          submitted_at?: string | null
          title: string
          updated_at?: string
          user_id: string
          ward?: string | null
        }
        Update: {
          address?: string | null
          auction_format?: string
          child_slug?: string
          chosen_org_id?: string | null
          commission_pct?: number | null
          created_at?: string
          delta_fields?: Json
          description?: string | null
          district?: string | null
          doc_urls?: string[]
          expected_timeline?: string | null
          has_dispute?: boolean | null
          has_mortgage?: boolean | null
          id?: string
          image_urls?: string[]
          is_seized?: boolean | null
          legal_notes?: string | null
          ownership_proof_urls?: string[]
          parent_slug?: string
          pricing_mode?: string
          province?: string | null
          right_to_sell?: boolean
          starting_price?: number | null
          status?: string
          submitted_at?: string | null
          title?: string
          updated_at?: string
          user_id?: string
          ward?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "asset_postings_chosen_org_id_fkey"
            columns: ["chosen_org_id"]
            isOneToOne: false
            referencedRelation: "auction_organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_postings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_service_requests: {
        Row: {
          asset_posting_id: string
          auction_org_id: string
          created_at: string
          id: string
          match_score: number | null
          message: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          asset_posting_id: string
          auction_org_id: string
          created_at?: string
          id?: string
          match_score?: number | null
          message?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          asset_posting_id?: string
          auction_org_id?: string
          created_at?: string
          id?: string
          match_score?: number | null
          message?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_service_requests_asset_posting_id_fkey"
            columns: ["asset_posting_id"]
            isOneToOne: false
            referencedRelation: "asset_postings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_service_requests_auction_org_id_fkey"
            columns: ["auction_org_id"]
            isOneToOne: false
            referencedRelation: "auction_organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_service_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      auction_organizations: {
        Row: {
          address: string | null
          created_at: string
          email: string | null
          id: string
          logo_url: string | null
          name: string
          org_type: number | null
          phone: string | null
          province: string | null
          tax_code: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          logo_url?: string | null
          name: string
          org_type?: number | null
          phone?: string | null
          province?: string | null
          tax_code?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          org_type?: number | null
          phone?: string | null
          province?: string | null
          tax_code?: string | null
        }
        Relationships: []
      }
      contact_submissions: {
        Row: {
          created_at: string
          email: string | null
          id: string
          message: string
          name: string
          phone: string
          status: string
          subject: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          message: string
          name: string
          phone: string
          status?: string
          subject?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          message?: string
          name?: string
          phone?: string
          status?: string
          subject?: string | null
        }
        Relationships: []
      }
      credit_transactions: {
        Row: {
          created_at: string
          credit_delta: number
          description: string
          id: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          credit_delta: number
          description: string
          id?: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          credit_delta?: number
          description?: string
          id?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      listing_price_sessions: {
        Row: {
          area: number | null
          created_at: string
          district: string | null
          id: string
          listing_id: string
          price: number
          property_type: string | null
          session_date: string
        }
        Insert: {
          area?: number | null
          created_at?: string
          district?: string | null
          id?: string
          listing_id: string
          price: number
          property_type?: string | null
          session_date: string
        }
        Update: {
          area?: number | null
          created_at?: string
          district?: string | null
          id?: string
          listing_id?: string
          price?: number
          property_type?: string | null
          session_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_price_sessions_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
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
          asset_owner_id: string | null
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
          asset_owner_id?: string | null
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
          asset_owner_id?: string | null
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
            foreignKeyName: "listings_asset_owner_id_fkey"
            columns: ["asset_owner_id"]
            isOneToOne: false
            referencedRelation: "asset_owners"
            referencedColumns: ["id"]
          },
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
      owner_report_views: {
        Row: {
          credits_charged: number
          filter_combo: Json
          id: string
          is_default: boolean
          user_id: string
          viewed_at: string
          workspace_id: string
        }
        Insert: {
          credits_charged?: number
          filter_combo?: Json
          id?: string
          is_default?: boolean
          user_id: string
          viewed_at?: string
          workspace_id: string
        }
        Update: {
          credits_charged?: number
          filter_combo?: Json
          id?: string
          is_default?: boolean
          user_id?: string
          viewed_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "owner_report_views_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "asset_owner_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      partnership_registrations: {
        Row: {
          contact_name: string
          created_at: string
          email: string
          id: string
          note: string | null
          org_name: string
          phone: string
          province: string
          status: string
        }
        Insert: {
          contact_name: string
          created_at?: string
          email: string
          id?: string
          note?: string | null
          org_name: string
          phone: string
          province: string
          status?: string
        }
        Update: {
          contact_name?: string
          created_at?: string
          email?: string
          id?: string
          note?: string | null
          org_name?: string
          phone?: string
          province?: string
          status?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          agent_info: Json | null
          created_at: string
          email: string
          free_unlock_tokens: number
          id: string
          invoice_info: Json | null
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
          free_unlock_tokens?: number
          id: string
          invoice_info?: Json | null
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
          free_unlock_tokens?: number
          id?: string
          invoice_info?: Json | null
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
      user_asset_unlocks: {
        Row: {
          created_at: string
          id: string
          listing_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          listing_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          listing_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_asset_unlocks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_company_unlocks: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          org_id: string
          tier: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          org_id: string
          tier: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          org_id?: string
          tier?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_company_unlocks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_credits: {
        Row: {
          balance: number
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_credits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_owner_unlocks: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          owner_id: string
          tier: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          owner_id: string
          tier: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          owner_id?: string
          tier?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_owner_unlocks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_report_unlocks: {
        Row: {
          created_at: string
          id: string
          unlock_key: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          unlock_key: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          unlock_key?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_report_unlocks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      workspace_branches: {
        Row: {
          asset_owner_id: string | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          display_name: string | null
          id: string
          is_active: boolean
          is_amc: boolean
          notes: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          asset_owner_id?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          is_active?: boolean
          is_amc?: boolean
          notes?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          asset_owner_id?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          is_active?: boolean
          is_amc?: boolean
          notes?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_branches_asset_owner_id_fkey"
            columns: ["asset_owner_id"]
            isOneToOne: false
            referencedRelation: "asset_owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_branches_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "asset_owner_workspaces"
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
