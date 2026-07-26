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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      ad_daily_stats: {
        Row: {
          advertisement_id: string
          clicks: number
          created_at: string
          device: string
          id: string
          stat_date: string
          views: number
        }
        Insert: {
          advertisement_id: string
          clicks?: number
          created_at?: string
          device: string
          id?: string
          stat_date: string
          views?: number
        }
        Update: {
          advertisement_id?: string
          clicks?: number
          created_at?: string
          device?: string
          id?: string
          stat_date?: string
          views?: number
        }
        Relationships: [
          {
            foreignKeyName: "ad_daily_stats_advertisement_id_fkey"
            columns: ["advertisement_id"]
            isOneToOne: false
            referencedRelation: "advertisements"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_pages: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      ad_positions: {
        Row: {
          auction_ends_at: string | null
          bidder_count: number
          code: string | null
          created_at: string
          desktop_height: number
          desktop_width: number
          id: string
          is_active: boolean
          mobile_height: number
          mobile_width: number
          name: string
          page_id: string
          placement_type: string
          price: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          auction_ends_at?: string | null
          bidder_count?: number
          code?: string | null
          created_at?: string
          desktop_height?: number
          desktop_width?: number
          id?: string
          is_active?: boolean
          mobile_height?: number
          mobile_width?: number
          name: string
          page_id: string
          placement_type?: string
          price?: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          auction_ends_at?: string | null
          bidder_count?: number
          code?: string | null
          created_at?: string
          desktop_height?: number
          desktop_width?: number
          id?: string
          is_active?: boolean
          mobile_height?: number
          mobile_width?: number
          name?: string
          page_id?: string
          placement_type?: string
          price?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_positions_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "ad_pages"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_role_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          id: string
          role_id: string
          user_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          role_id: string
          user_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          role_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_role_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_role_assignments_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "admin_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_role_assignments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_role_permissions: {
        Row: {
          action: string
          created_at: string
          id: string
          module: string
          role_id: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          module: string
          role_id: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          module?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "admin_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_roles: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          is_system: boolean
          name: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      advertisements: {
        Row: {
          click_count: number
          code: string | null
          created_at: string
          created_by: string | null
          customer_id: string | null
          desktop_image_url: string | null
          end_at: string | null
          end_type: string
          id: string
          is_test: boolean
          mobile_image_url: string | null
          name: string
          nav_filter: Json | null
          nav_type: string
          nav_url: string | null
          position_id: string
          show_desktop: boolean
          show_mobile: boolean
          sort_order: number
          start_at: string | null
          start_type: string
          status: string
          updated_at: string
          view_count: number
        }
        Insert: {
          click_count?: number
          code?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          desktop_image_url?: string | null
          end_at?: string | null
          end_type?: string
          id?: string
          is_test?: boolean
          mobile_image_url?: string | null
          name: string
          nav_filter?: Json | null
          nav_type?: string
          nav_url?: string | null
          position_id: string
          show_desktop?: boolean
          show_mobile?: boolean
          sort_order?: number
          start_at?: string | null
          start_type?: string
          status?: string
          updated_at?: string
          view_count?: number
        }
        Update: {
          click_count?: number
          code?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          desktop_image_url?: string | null
          end_at?: string | null
          end_type?: string
          id?: string
          is_test?: boolean
          mobile_image_url?: string | null
          name?: string
          nav_filter?: Json | null
          nav_type?: string
          nav_url?: string | null
          position_id?: string
          show_desktop?: boolean
          show_mobile?: boolean
          sort_order?: number
          start_at?: string | null
          start_type?: string
          status?: string
          updated_at?: string
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "advertisements_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "advertisements_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "ad_positions"
            referencedColumns: ["id"]
          },
        ]
      }
      analytics_events: {
        Row: {
          browser: string | null
          created_at: string
          device_type: string | null
          event_type: string
          feature_key: string | null
          id: string
          os: string | null
          path: string | null
          province: string | null
          referrer: string | null
          session_id: string
          user_id: string | null
        }
        Insert: {
          browser?: string | null
          created_at?: string
          device_type?: string | null
          event_type: string
          feature_key?: string | null
          id?: string
          os?: string | null
          path?: string | null
          province?: string | null
          referrer?: string | null
          session_id: string
          user_id?: string | null
        }
        Update: {
          browser?: string | null
          created_at?: string
          device_type?: string | null
          event_type?: string
          feature_key?: string | null
          id?: string
          os?: string | null
          path?: string | null
          province?: string | null
          referrer?: string | null
          session_id?: string
          user_id?: string | null
        }
        Relationships: []
      }
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
      auction_tool_providers: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_own: boolean
          logo_url: string | null
          name: string
          price_label: string | null
          service_id: string | null
          service_variant_id: string | null
          slug: string
          sort_order: number
          status: string
          supplier_id: string | null
          tagline: string | null
          tool_id: string
          updated_at: string
          website: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_own?: boolean
          logo_url?: string | null
          name: string
          price_label?: string | null
          service_id?: string | null
          service_variant_id?: string | null
          slug: string
          sort_order?: number
          status?: string
          supplier_id?: string | null
          tagline?: string | null
          tool_id: string
          updated_at?: string
          website?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_own?: boolean
          logo_url?: string | null
          name?: string
          price_label?: string | null
          service_id?: string | null
          service_variant_id?: string | null
          slug?: string
          sort_order?: number
          status?: string
          supplier_id?: string | null
          tagline?: string | null
          tool_id?: string
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "auction_tool_providers_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auction_tool_providers_service_variant_id_fkey"
            columns: ["service_variant_id"]
            isOneToOne: false
            referencedRelation: "service_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auction_tool_providers_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auction_tool_providers_tool_id_fkey"
            columns: ["tool_id"]
            isOneToOne: false
            referencedRelation: "auction_tools"
            referencedColumns: ["id"]
          },
        ]
      }
      auction_tool_showcases: {
        Row: {
          access_password: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          kind: string
          provider_id: string
          sort_order: number
          thumbnail_url: string | null
          title: string
          updated_at: string
          url: string
          visibility: string
        }
        Insert: {
          access_password?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          kind?: string
          provider_id: string
          sort_order?: number
          thumbnail_url?: string | null
          title: string
          updated_at?: string
          url: string
          visibility?: string
        }
        Update: {
          access_password?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          kind?: string
          provider_id?: string
          sort_order?: number
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
          url?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "auction_tool_showcases_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "auction_tool_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      auction_tools: {
        Row: {
          created_at: string
          description: string | null
          icon: string | null
          id: string
          is_active: boolean
          key: string
          name: string
          slug: string
          sort_order: number
          tagline: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          key: string
          name: string
          slug: string
          sort_order?: number
          tagline?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          key?: string
          name?: string
          slug?: string
          sort_order?: number
          tagline?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      campaign_recipients: {
        Row: {
          campaign_id: string
          clicked_at: string | null
          created_at: string
          email: string
          id: string
          name: string | null
          opened_at: string | null
          sent_at: string | null
          status: string
          user_id: string | null
        }
        Insert: {
          campaign_id: string
          clicked_at?: string | null
          created_at?: string
          email: string
          id?: string
          name?: string | null
          opened_at?: string | null
          sent_at?: string | null
          status?: string
          user_id?: string | null
        }
        Update: {
          campaign_id?: string
          clicked_at?: string | null
          created_at?: string
          email?: string
          id?: string
          name?: string | null
          opened_at?: string | null
          sent_at?: string | null
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_recipients_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "marketing_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_recipients_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
          amount_vnd: number | null
          created_at: string
          credit_delta: number
          description: string
          id: string
          service_variant_id: string | null
          type: string
          user_id: string
          variant_key: string | null
        }
        Insert: {
          amount_vnd?: number | null
          created_at?: string
          credit_delta: number
          description: string
          id?: string
          service_variant_id?: string | null
          type: string
          user_id: string
          variant_key?: string | null
        }
        Update: {
          amount_vnd?: number | null
          created_at?: string
          credit_delta?: number
          description?: string
          id?: string
          service_variant_id?: string | null
          type?: string
          user_id?: string
          variant_key?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "credit_transactions_service_variant_id_fkey"
            columns: ["service_variant_id"]
            isOneToOne: false
            referencedRelation: "service_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          code: string | null
          contact_name: string | null
          created_at: string
          created_by: string | null
          customer_type: string
          email: string | null
          id: string
          name: string
          note: string | null
          phone: string | null
          segment: string
          source_lead_id: string | null
          status: string
          tax_code: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          address?: string | null
          code?: string | null
          contact_name?: string | null
          created_at?: string
          created_by?: string | null
          customer_type?: string
          email?: string | null
          id?: string
          name: string
          note?: string | null
          phone?: string | null
          segment?: string
          source_lead_id?: string | null
          status?: string
          tax_code?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          address?: string | null
          code?: string | null
          contact_name?: string | null
          created_at?: string
          created_by?: string | null
          customer_type?: string
          email?: string | null
          id?: string
          name?: string
          note?: string | null
          phone?: string | null
          segment?: string
          source_lead_id?: string | null
          status?: string
          tax_code?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_source_lead_id_fkey"
            columns: ["source_lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          assigned_to: string | null
          code: string | null
          company_name: string | null
          contact_name: string | null
          converted_at: string | null
          converted_customer_id: string | null
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          lead_type: string
          name: string
          note: string | null
          phone: string | null
          province: string | null
          source: string
          status: string
          tool_provider_id: string | null
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          code?: string | null
          company_name?: string | null
          contact_name?: string | null
          converted_at?: string | null
          converted_customer_id?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          lead_type?: string
          name: string
          note?: string | null
          phone?: string | null
          province?: string | null
          source?: string
          status?: string
          tool_provider_id?: string | null
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          code?: string | null
          company_name?: string | null
          contact_name?: string | null
          converted_at?: string | null
          converted_customer_id?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          lead_type?: string
          name?: string
          note?: string | null
          phone?: string | null
          province?: string | null
          source?: string
          status?: string
          tool_provider_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_converted_customer_id_fkey"
            columns: ["converted_customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_tool_provider_id_fkey"
            columns: ["tool_provider_id"]
            isOneToOne: false
            referencedRelation: "auction_tool_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_documents: {
        Row: {
          changelog: string | null
          content: string | null
          created_at: string
          doc_type: string
          effective_date: string
          id: string
          updated_at: string
          version: string
        }
        Insert: {
          changelog?: string | null
          content?: string | null
          created_at?: string
          doc_type: string
          effective_date: string
          id?: string
          updated_at?: string
          version: string
        }
        Update: {
          changelog?: string | null
          content?: string | null
          created_at?: string
          doc_type?: string
          effective_date?: string
          id?: string
          updated_at?: string
          version?: string
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
      marketing_campaigns: {
        Row: {
          audience_spec: Json
          channel: string
          clicked_count: number
          content_html: string | null
          created_at: string
          created_by: string | null
          eligible_count: number | null
          id: string
          name: string
          notes: string | null
          opened_count: number
          preview_text: string | null
          recipient_count: number
          respect_optin: boolean
          schedule_type: string
          scheduled_at: string | null
          sent_at: string | null
          sent_count: number
          status: string
          subject: string | null
          updated_at: string
        }
        Insert: {
          audience_spec?: Json
          channel?: string
          clicked_count?: number
          content_html?: string | null
          created_at?: string
          created_by?: string | null
          eligible_count?: number | null
          id?: string
          name: string
          notes?: string | null
          opened_count?: number
          preview_text?: string | null
          recipient_count?: number
          respect_optin?: boolean
          schedule_type?: string
          scheduled_at?: string | null
          sent_at?: string | null
          sent_count?: number
          status?: string
          subject?: string | null
          updated_at?: string
        }
        Update: {
          audience_spec?: Json
          channel?: string
          clicked_count?: number
          content_html?: string | null
          created_at?: string
          created_by?: string | null
          eligible_count?: number | null
          id?: string
          name?: string
          notes?: string | null
          opened_count?: number
          preview_text?: string | null
          recipient_count?: number
          respect_optin?: boolean
          schedule_type?: string
          scheduled_at?: string | null
          sent_at?: string | null
          sent_count?: number
          status?: string
          subject?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      opportunities: {
        Row: {
          amount: number
          assigned_to: string | null
          closed_at: string | null
          code: string | null
          commission_type: string | null
          commission_value: number | null
          created_at: string
          created_by: string | null
          customer_id: string | null
          expected_close_at: string | null
          gross_amount: number
          id: string
          lead_id: string | null
          lost_reason: string | null
          name: string
          note: string | null
          opportunity_type: string
          revenue_mode: string
          service_id: string
          service_kind: string
          service_variant_id: string | null
          sort_order: number
          stage: string
          tool_provider_id: string | null
          updated_at: string
          won_order_id: string | null
        }
        Insert: {
          amount?: number
          assigned_to?: string | null
          closed_at?: string | null
          code?: string | null
          commission_type?: string | null
          commission_value?: number | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          expected_close_at?: string | null
          gross_amount?: number
          id?: string
          lead_id?: string | null
          lost_reason?: string | null
          name: string
          note?: string | null
          opportunity_type?: string
          revenue_mode?: string
          service_id: string
          service_kind?: string
          service_variant_id?: string | null
          sort_order?: number
          stage?: string
          tool_provider_id?: string | null
          updated_at?: string
          won_order_id?: string | null
        }
        Update: {
          amount?: number
          assigned_to?: string | null
          closed_at?: string | null
          code?: string | null
          commission_type?: string | null
          commission_value?: number | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          expected_close_at?: string | null
          gross_amount?: number
          id?: string
          lead_id?: string | null
          lost_reason?: string | null
          name?: string
          note?: string | null
          opportunity_type?: string
          revenue_mode?: string
          service_id?: string
          service_kind?: string
          service_variant_id?: string | null
          sort_order?: number
          stage?: string
          tool_provider_id?: string | null
          updated_at?: string
          won_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "opportunities_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_service_variant_id_fkey"
            columns: ["service_variant_id"]
            isOneToOne: false
            referencedRelation: "service_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_tool_provider_id_fkey"
            columns: ["tool_provider_id"]
            isOneToOne: false
            referencedRelation: "auction_tool_providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_won_order_id_fkey"
            columns: ["won_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          advertisement_id: string | null
          amount: number
          code: string | null
          commission_type: string | null
          commission_value: number | null
          created_at: string
          created_by: string | null
          credit_transaction_id: string | null
          customer_id: string | null
          fulfilled_at: string | null
          fulfillment_status: string
          gross_amount: number
          id: string
          note: string | null
          opportunity_id: string | null
          ordered_at: string
          quantity: number
          service_id: string
          service_kind: string
          service_variant_id: string | null
          supplier_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          advertisement_id?: string | null
          amount?: number
          code?: string | null
          commission_type?: string | null
          commission_value?: number | null
          created_at?: string
          created_by?: string | null
          credit_transaction_id?: string | null
          customer_id?: string | null
          fulfilled_at?: string | null
          fulfillment_status?: string
          gross_amount?: number
          id?: string
          note?: string | null
          opportunity_id?: string | null
          ordered_at?: string
          quantity?: number
          service_id: string
          service_kind?: string
          service_variant_id?: string | null
          supplier_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          advertisement_id?: string | null
          amount?: number
          code?: string | null
          commission_type?: string | null
          commission_value?: number | null
          created_at?: string
          created_by?: string | null
          credit_transaction_id?: string | null
          customer_id?: string | null
          fulfilled_at?: string | null
          fulfillment_status?: string
          gross_amount?: number
          id?: string
          note?: string | null
          opportunity_id?: string | null
          ordered_at?: string
          quantity?: number
          service_id?: string
          service_kind?: string
          service_variant_id?: string | null
          supplier_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_advertisement_id_fkey"
            columns: ["advertisement_id"]
            isOneToOne: false
            referencedRelation: "advertisements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_credit_transaction_id_fkey"
            columns: ["credit_transaction_id"]
            isOneToOne: false
            referencedRelation: "credit_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_service_variant_id_fkey"
            columns: ["service_variant_id"]
            isOneToOne: false
            referencedRelation: "service_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
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
      partners: {
        Row: {
          accent_color: string
          badge: string
          created_at: string
          cta_href: string | null
          cta_text: string | null
          date_label: string | null
          date_value: string | null
          description: string | null
          id: string
          logo_filter: string | null
          logo_url: string | null
          name: string
          sort_order: number
          stats: Json
          status: string
          supplier_id: string | null
          tagline: string | null
          updated_at: string
        }
        Insert: {
          accent_color?: string
          badge?: string
          created_at?: string
          cta_href?: string | null
          cta_text?: string | null
          date_label?: string | null
          date_value?: string | null
          description?: string | null
          id?: string
          logo_filter?: string | null
          logo_url?: string | null
          name: string
          sort_order?: number
          stats?: Json
          status?: string
          supplier_id?: string | null
          tagline?: string | null
          updated_at?: string
        }
        Update: {
          accent_color?: string
          badge?: string
          created_at?: string
          cta_href?: string | null
          cta_text?: string | null
          date_label?: string | null
          date_value?: string | null
          description?: string | null
          id?: string
          logo_filter?: string | null
          logo_url?: string | null
          name?: string
          sort_order?: number
          stats?: Json
          status?: string
          supplier_id?: string | null
          tagline?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "partners_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
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
          activated: boolean
          activated_at: string | null
          agent_info: Json | null
          created_at: string
          email: string
          free_unlock_tokens: number
          id: string
          invoice_info: Json | null
          kyc_status: Database["public"]["Enums"]["kyc_status"]
          name: string | null
          notifications_enabled: boolean
          privacy_accepted_at: string | null
          privacy_version: string | null
          rejection_reason: string | null
          status: string
          terms_accepted_at: string | null
          terms_version: string | null
          updated_at: string
        }
        Insert: {
          activated?: boolean
          activated_at?: string | null
          agent_info?: Json | null
          created_at?: string
          email: string
          free_unlock_tokens?: number
          id: string
          invoice_info?: Json | null
          kyc_status?: Database["public"]["Enums"]["kyc_status"]
          name?: string | null
          notifications_enabled?: boolean
          privacy_accepted_at?: string | null
          privacy_version?: string | null
          rejection_reason?: string | null
          status?: string
          terms_accepted_at?: string | null
          terms_version?: string | null
          updated_at?: string
        }
        Update: {
          activated?: boolean
          activated_at?: string | null
          agent_info?: Json | null
          created_at?: string
          email?: string
          free_unlock_tokens?: number
          id?: string
          invoice_info?: Json | null
          kyc_status?: Database["public"]["Enums"]["kyc_status"]
          name?: string | null
          notifications_enabled?: boolean
          privacy_accepted_at?: string | null
          privacy_version?: string | null
          rejection_reason?: string | null
          status?: string
          terms_accepted_at?: string | null
          terms_version?: string | null
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
      service_variants: {
        Row: {
          base_credits: number | null
          code: string | null
          commission_type: string | null
          commission_value: number | null
          created_at: string
          created_by: string | null
          credit_cost: number | null
          credits: number | null
          id: string
          is_active: boolean
          is_best: boolean
          is_popular: boolean
          name: string
          price: number
          service_id: string
          sort_order: number
          updated_at: string
          variant_key: string
        }
        Insert: {
          base_credits?: number | null
          code?: string | null
          commission_type?: string | null
          commission_value?: number | null
          created_at?: string
          created_by?: string | null
          credit_cost?: number | null
          credits?: number | null
          id?: string
          is_active?: boolean
          is_best?: boolean
          is_popular?: boolean
          name: string
          price?: number
          service_id: string
          sort_order?: number
          updated_at?: string
          variant_key: string
        }
        Update: {
          base_credits?: number | null
          code?: string | null
          commission_type?: string | null
          commission_value?: number | null
          created_at?: string
          created_by?: string | null
          credit_cost?: number | null
          credits?: number | null
          id?: string
          is_active?: boolean
          is_best?: boolean
          is_popular?: boolean
          name?: string
          price?: number
          service_id?: string
          sort_order?: number
          updated_at?: string
          variant_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_variants_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          audience: string
          category: string | null
          code: string | null
          created_at: string
          created_by: string | null
          credit_cost: number | null
          credit_feature_key: string | null
          description: string | null
          id: string
          is_active: boolean
          kind: string
          name: string
          price: number
          sort_order: number
          supplier_id: string | null
          updated_at: string
        }
        Insert: {
          audience?: string
          category?: string | null
          code?: string | null
          created_at?: string
          created_by?: string | null
          credit_cost?: number | null
          credit_feature_key?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          kind?: string
          name: string
          price?: number
          sort_order?: number
          supplier_id?: string | null
          updated_at?: string
        }
        Update: {
          audience?: string
          category?: string | null
          code?: string | null
          created_at?: string
          created_by?: string | null
          credit_cost?: number | null
          credit_feature_key?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          kind?: string
          name?: string
          price?: number
          sort_order?: number
          supplier_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string | null
          bank_account: string | null
          bank_name: string | null
          code: string | null
          contact_name: string | null
          created_at: string
          created_by: string | null
          default_commission_rate: number | null
          default_commission_type: string | null
          email: string | null
          id: string
          name: string
          note: string | null
          phone: string | null
          status: string
          supplier_type: string
          tax_code: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          bank_account?: string | null
          bank_name?: string | null
          code?: string | null
          contact_name?: string | null
          created_at?: string
          created_by?: string | null
          default_commission_rate?: number | null
          default_commission_type?: string | null
          email?: string | null
          id?: string
          name: string
          note?: string | null
          phone?: string | null
          status?: string
          supplier_type?: string
          tax_code?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          bank_account?: string | null
          bank_name?: string | null
          code?: string | null
          contact_name?: string | null
          created_at?: string
          created_by?: string | null
          default_commission_rate?: number | null
          default_commission_type?: string | null
          email?: string | null
          id?: string
          name?: string
          note?: string | null
          phone?: string | null
          status?: string
          supplier_type?: string
          tax_code?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          assignee_id: string | null
          closed_at: string | null
          code: string | null
          created_at: string
          created_by: string | null
          customer_id: string | null
          description: string | null
          due_at: string | null
          id: string
          lead_id: string | null
          opportunity_id: string | null
          order_id: string | null
          priority: string
          status: string
          task_type: string
          title: string
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          closed_at?: string | null
          code?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          description?: string | null
          due_at?: string | null
          id?: string
          lead_id?: string | null
          opportunity_id?: string | null
          order_id?: string | null
          priority?: string
          status?: string
          task_type?: string
          title: string
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          closed_at?: string | null
          code?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          description?: string | null
          due_at?: string | null
          id?: string
          lead_id?: string | null
          opportunity_id?: string | null
          order_id?: string | null
          priority?: string
          status?: string
          task_type?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          assignee_id: string | null
          body: string | null
          code: string | null
          contact_submission_id: string | null
          created_at: string
          created_by: string | null
          customer_id: string | null
          first_response_at: string | null
          id: string
          lead_id: string | null
          meta: Json
          opportunity_id: string | null
          order_id: string | null
          partnership_registration_id: string | null
          priority: string
          requester_email: string | null
          requester_name: string | null
          requester_phone: string | null
          resolution_note: string | null
          resolved_at: string | null
          source: string
          status: string
          subject: string
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          body?: string | null
          code?: string | null
          contact_submission_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          first_response_at?: string | null
          id?: string
          lead_id?: string | null
          meta?: Json
          opportunity_id?: string | null
          order_id?: string | null
          partnership_registration_id?: string | null
          priority?: string
          requester_email?: string | null
          requester_name?: string | null
          requester_phone?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          source?: string
          status?: string
          subject: string
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          body?: string | null
          code?: string | null
          contact_submission_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          first_response_at?: string | null
          id?: string
          lead_id?: string | null
          meta?: Json
          opportunity_id?: string | null
          order_id?: string | null
          partnership_registration_id?: string | null
          priority?: string
          requester_email?: string | null
          requester_name?: string | null
          requester_phone?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          source?: string
          status?: string
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tickets_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_contact_submission_id_fkey"
            columns: ["contact_submission_id"]
            isOneToOne: true
            referencedRelation: "contact_submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_partnership_registration_id_fkey"
            columns: ["partnership_registration_id"]
            isOneToOne: true
            referencedRelation: "partnership_registrations"
            referencedColumns: ["id"]
          },
        ]
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
      admin_access_report: {
        Args: { _from: string; _granularity?: string; _to: string }
        Returns: Json
      }
      admin_convert_lead: {
        Args: { _customer_id?: string; _lead_id: string }
        Returns: string
      }
      admin_grant_credits: {
        Args: { _amount: number; _note?: string; _user_id: string }
        Returns: number
      }
      admin_has_permission: {
        Args: { _action: string; _module: string }
        Returns: boolean
      }
      admin_is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      admin_set_role_permissions: {
        Args: { _perms: Json; _role_id: string }
        Returns: undefined
      }
      admin_unwin_opportunity: {
        Args: { _opportunity_id: string }
        Returns: undefined
      }
      admin_win_opportunity: {
        Args: {
          _amount?: number
          _customer_id?: string
          _gross?: number
          _opportunity_id: string
          _ordered_at?: string
        }
        Returns: Json
      }
      check_email_exists: { Args: { _email: string }; Returns: boolean }
      count_campaign_audience: {
        Args: { _respect_optin?: boolean; _spec: Json }
        Returns: number
      }
      credit_fallback_service_id: { Args: never; Returns: string }
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
      list_tool_showcases: {
        Args: { _provider_id: string }
        Returns: {
          description: string
          id: string
          is_locked: boolean
          kind: string
          sort_order: number
          thumbnail_url: string
          title: string
          url: string
          visibility: string
        }[]
      }
      request_tool_service: {
        Args: { _note?: string; _provider_id: string }
        Returns: Json
      }
      resolve_campaign_audience: {
        Args: {
          _limit?: number
          _offset?: number
          _respect_optin?: boolean
          _spec: Json
        }
        Returns: {
          email: string
          name: string
          total_count: number
          user_id: string
        }[]
      }
      unlock_tool_showcase: {
        Args: { _id: string; _password: string }
        Returns: string
      }
      user_province: { Args: { uid: string }; Returns: string }
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
  graphql_public: {
    Enums: {},
  },
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
