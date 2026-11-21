// Generated from the live database by Supabase (generate_typescript_types). Do not edit by hand: regenerate after a migration.
// Not yet wired into the Supabase client; import the `Database` type from here in new code.
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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      announcements: {
        Row: {
          body: string
          conference_id: string
          created_at: string
          created_by: string | null
          id: string
        }
        Insert: {
          body: string
          conference_id: string
          created_at?: string
          created_by?: string | null
          id?: string
        }
        Update: {
          body?: string
          conference_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_conference_id_fkey"
            columns: ["conference_id"]
            isOneToOne: false
            referencedRelation: "conferences"
            referencedColumns: ["id"]
          },
        ]
      }
      applications: {
        Row: {
          allocation_sent_at: string | null
          checked_in_at: string | null
          checked_in_by: string | null
          checkin_token: string
          committee: string
          conference_id: string
          confirmed_at: string | null
          country: string
          created_at: string
          emailed_status: string | null
          experience: string
          id: string
          kind: string
          name: string
          note: string
          prefs: Json
          redacted_at: string | null
          role_title: string
          school: string
          status: string
          status_changed_at: string | null
          updated_at: string
          user_id: string
          withdrawn_mail_at: string | null
          year: string
        }
        Insert: {
          allocation_sent_at?: string | null
          checked_in_at?: string | null
          checked_in_by?: string | null
          checkin_token?: string
          committee?: string
          conference_id: string
          confirmed_at?: string | null
          country?: string
          created_at?: string
          emailed_status?: string | null
          experience?: string
          id?: string
          kind: string
          name: string
          note?: string
          prefs?: Json
          redacted_at?: string | null
          role_title?: string
          school?: string
          status?: string
          status_changed_at?: string | null
          updated_at?: string
          user_id: string
          withdrawn_mail_at?: string | null
          year?: string
        }
        Update: {
          allocation_sent_at?: string | null
          checked_in_at?: string | null
          checked_in_by?: string | null
          checkin_token?: string
          committee?: string
          conference_id?: string
          confirmed_at?: string | null
          country?: string
          created_at?: string
          emailed_status?: string | null
          experience?: string
          id?: string
          kind?: string
          name?: string
          note?: string
          prefs?: Json
          redacted_at?: string | null
          role_title?: string
          school?: string
          status?: string
          status_changed_at?: string | null
          updated_at?: string
          user_id?: string
          withdrawn_mail_at?: string | null
          year?: string
        }
        Relationships: [
          {
            foreignKeyName: "applications_conference_id_fkey"
            columns: ["conference_id"]
            isOneToOne: false
            referencedRelation: "conferences"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor: string | null
          actor_email: string
          at: string
          detail: Json
          id: number
          target_id: string
          target_label: string
          target_type: string
        }
        Insert: {
          action: string
          actor?: string | null
          actor_email?: string
          at?: string
          detail?: Json
          id?: never
          target_id: string
          target_label?: string
          target_type: string
        }
        Update: {
          action?: string
          actor?: string | null
          actor_email?: string
          at?: string
          detail?: Json
          id?: never
          target_id?: string
          target_label?: string
          target_type?: string
        }
        Relationships: []
      }
      broadcasts: {
        Row: {
          audience: string
          body: string
          conference_id: string
          created_at: string
          id: string
          recipients: number
          sent_by: string | null
          subject: string
        }
        Insert: {
          audience: string
          body: string
          conference_id: string
          created_at?: string
          id?: string
          recipients: number
          sent_by?: string | null
          subject: string
        }
        Update: {
          audience?: string
          body?: string
          conference_id?: string
          created_at?: string
          id?: string
          recipients?: number
          sent_by?: string | null
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "broadcasts_conference_id_fkey"
            columns: ["conference_id"]
            isOneToOne: false
            referencedRelation: "conferences"
            referencedColumns: ["id"]
          },
        ]
      }
      chamber_asks: {
        Row: {
          body: Json
          chamber_id: string
          created_at: string
          delegate_id: string
          id: string
          kind: string
          status: string
          user_id: string
        }
        Insert: {
          body?: Json
          chamber_id: string
          created_at?: string
          delegate_id: string
          id?: string
          kind: string
          status?: string
          user_id: string
        }
        Update: {
          body?: Json
          chamber_id?: string
          created_at?: string
          delegate_id?: string
          id?: string
          kind?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chamber_asks_chamber_id_fkey"
            columns: ["chamber_id"]
            isOneToOne: false
            referencedRelation: "chambers"
            referencedColumns: ["id"]
          },
        ]
      }
      chamber_feedback: {
        Row: {
          chamber_id: string
          committee_name: string
          conference_id: string
          id: string
          mark: number | null
          note: string
          released_at: string
          released_by: string | null
          state_id: string
          state_name: string
        }
        Insert: {
          chamber_id: string
          committee_name?: string
          conference_id: string
          id?: string
          mark?: number | null
          note?: string
          released_at?: string
          released_by?: string | null
          state_id: string
          state_name: string
        }
        Update: {
          chamber_id?: string
          committee_name?: string
          conference_id?: string
          id?: string
          mark?: number | null
          note?: string
          released_at?: string
          released_by?: string | null
          state_id?: string
          state_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "chamber_feedback_chamber_id_fkey"
            columns: ["chamber_id"]
            isOneToOne: false
            referencedRelation: "chambers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chamber_feedback_conference_id_fkey"
            columns: ["conference_id"]
            isOneToOne: false
            referencedRelation: "conferences"
            referencedColumns: ["id"]
          },
        ]
      }
      chamber_files: {
        Row: {
          chamber_id: string
          created_at: string
          from_id: string
          id: string
          name: string
          path: string
          size: number
          user_id: string
        }
        Insert: {
          chamber_id: string
          created_at?: string
          from_id: string
          id?: string
          name: string
          path: string
          size: number
          user_id: string
        }
        Update: {
          chamber_id?: string
          created_at?: string
          from_id?: string
          id?: string
          name?: string
          path?: string
          size?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chamber_files_chamber_id_fkey"
            columns: ["chamber_id"]
            isOneToOne: false
            referencedRelation: "chambers"
            referencedColumns: ["id"]
          },
        ]
      }
      chamber_members: {
        Row: {
          added_at: string
          chamber_id: string
          role: string
          user_id: string
        }
        Insert: {
          added_at?: string
          chamber_id: string
          role?: string
          user_id: string
        }
        Update: {
          added_at?: string
          chamber_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chamber_members_chamber_id_fkey"
            columns: ["chamber_id"]
            isOneToOne: false
            referencedRelation: "chambers"
            referencedColumns: ["id"]
          },
        ]
      }
      chamber_notes: {
        Row: {
          body: string
          chamber_id: string
          created_at: string
          from_id: string
          id: string
          to_id: string
          user_id: string
        }
        Insert: {
          body: string
          chamber_id: string
          created_at?: string
          from_id: string
          id?: string
          to_id: string
          user_id: string
        }
        Update: {
          body?: string
          chamber_id?: string
          created_at?: string
          from_id?: string
          id?: string
          to_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chamber_notes_chamber_id_fkey"
            columns: ["chamber_id"]
            isOneToOne: false
            referencedRelation: "chambers"
            referencedColumns: ["id"]
          },
        ]
      }
      chamber_seats: {
        Row: {
          approved: boolean
          chamber_id: string
          delegate_id: string
          joined_at: string
          user_id: string
        }
        Insert: {
          approved?: boolean
          chamber_id: string
          delegate_id: string
          joined_at?: string
          user_id: string
        }
        Update: {
          approved?: boolean
          chamber_id?: string
          delegate_id?: string
          joined_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chamber_seats_chamber_id_fkey"
            columns: ["chamber_id"]
            isOneToOne: false
            referencedRelation: "chambers"
            referencedColumns: ["id"]
          },
        ]
      }
      chamber_votes: {
        Row: {
          at: string
          ballot: string
          chamber_id: string
          delegate_id: string
          key: string
          user_id: string
        }
        Insert: {
          at?: string
          ballot: string
          chamber_id: string
          delegate_id: string
          key: string
          user_id: string
        }
        Update: {
          at?: string
          ballot?: string
          chamber_id?: string
          delegate_id?: string
          key?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chamber_votes_chamber_id_fkey"
            columns: ["chamber_id"]
            isOneToOne: false
            referencedRelation: "chambers"
            referencedColumns: ["id"]
          },
        ]
      }
      chambers: {
        Row: {
          committee: string
          conference_id: string | null
          created_at: string
          delegate_code: string | null
          devices: boolean
          id: string
          join_code: string | null
          name: string
          owner_id: string
          room: Json
          state: Json
          updated_at: string
          version: number
        }
        Insert: {
          committee?: string
          conference_id?: string | null
          created_at?: string
          delegate_code?: string | null
          devices?: boolean
          id?: string
          join_code?: string | null
          name: string
          owner_id: string
          room?: Json
          state: Json
          updated_at?: string
          version?: number
        }
        Update: {
          committee?: string
          conference_id?: string | null
          created_at?: string
          delegate_code?: string | null
          devices?: boolean
          id?: string
          join_code?: string | null
          name?: string
          owner_id?: string
          room?: Json
          state?: Json
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "chambers_conference_id_fkey"
            columns: ["conference_id"]
            isOneToOne: false
            referencedRelation: "conferences"
            referencedColumns: ["id"]
          },
        ]
      }
      conferences: {
        Row: {
          chair_opens_at: string | null
          chair_url: string | null
          claimable: boolean | null
          collex_applications: boolean
          collex_registration: boolean
          committees: Json
          contact: string
          cover_path: string | null
          cover_x: number | null
          cover_y: number | null
          created_at: string
          delegates: string
          delegation_opens_at: string | null
          delegation_url: string | null
          end_date: string | null
          fee: string
          guides: Json
          host: string
          id: string
          interest_url: string | null
          key_dates: Json
          level: string | null
          name: string
          overview: string
          published_at: string | null
          review_note: string
          roles: Json
          schedule: Json
          secretariat: Json
          short_name: string
          slug: string | null
          start_date: string | null
          status: string
          submitted_by: string | null
          submitter_role: string
          thumb_path: string | null
          thumb_x: number | null
          thumb_y: number | null
          updated_at: string
          venue: string
          verified: boolean
        }
        Insert: {
          chair_opens_at?: string | null
          chair_url?: string | null
          claimable?: boolean | null
          collex_applications?: boolean
          collex_registration?: boolean
          committees?: Json
          contact?: string
          cover_path?: string | null
          cover_x?: number | null
          cover_y?: number | null
          created_at?: string
          delegates?: string
          delegation_opens_at?: string | null
          delegation_url?: string | null
          end_date?: string | null
          fee?: string
          guides?: Json
          host: string
          id?: string
          interest_url?: string | null
          key_dates?: Json
          level?: string | null
          name: string
          overview?: string
          published_at?: string | null
          review_note?: string
          roles?: Json
          schedule?: Json
          secretariat?: Json
          short_name?: string
          slug?: string | null
          start_date?: string | null
          status?: string
          submitted_by?: string | null
          submitter_role?: string
          thumb_path?: string | null
          thumb_x?: number | null
          thumb_y?: number | null
          updated_at?: string
          venue?: string
          verified?: boolean
        }
        Update: {
          chair_opens_at?: string | null
          chair_url?: string | null
          claimable?: boolean | null
          collex_applications?: boolean
          collex_registration?: boolean
          committees?: Json
          contact?: string
          cover_path?: string | null
          cover_x?: number | null
          cover_y?: number | null
          created_at?: string
          delegates?: string
          delegation_opens_at?: string | null
          delegation_url?: string | null
          end_date?: string | null
          fee?: string
          guides?: Json
          host?: string
          id?: string
          interest_url?: string | null
          key_dates?: Json
          level?: string | null
          name?: string
          overview?: string
          published_at?: string | null
          review_note?: string
          roles?: Json
          schedule?: Json
          secretariat?: Json
          short_name?: string
          slug?: string | null
          start_date?: string | null
          status?: string
          submitted_by?: string | null
          submitter_role?: string
          thumb_path?: string | null
          thumb_x?: number | null
          thumb_y?: number | null
          updated_at?: string
          venue?: string
          verified?: boolean
        }
        Relationships: []
      }
      follows: {
        Row: {
          conference_id: string
          created_at: string
          token: string
          user_id: string
        }
        Insert: {
          conference_id: string
          created_at?: string
          token?: string
          user_id?: string
        }
        Update: {
          conference_id?: string
          created_at?: string
          token?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "follows_conference_id_fkey"
            columns: ["conference_id"]
            isOneToOne: false
            referencedRelation: "conferences"
            referencedColumns: ["id"]
          },
        ]
      }
      interests: {
        Row: {
          conference_id: string
          created_at: string
          user_id: string
        }
        Insert: {
          conference_id: string
          created_at?: string
          user_id?: string
        }
        Update: {
          conference_id?: string
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "interests_conference_id_fkey"
            columns: ["conference_id"]
            isOneToOne: false
            referencedRelation: "conferences"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_claims: {
        Row: {
          conference_id: string
          created_at: string
          decided_at: string | null
          id: string
          proof: string
          role: string
          status: string
          user_id: string
        }
        Insert: {
          conference_id: string
          created_at?: string
          decided_at?: string | null
          id?: string
          proof: string
          role: string
          status?: string
          user_id: string
        }
        Update: {
          conference_id?: string
          created_at?: string
          decided_at?: string | null
          id?: string
          proof?: string
          role?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_claims_conference_id_fkey"
            columns: ["conference_id"]
            isOneToOne: false
            referencedRelation: "conferences"
            referencedColumns: ["id"]
          },
        ]
      }
      organisers: {
        Row: {
          accepted_at: string | null
          conference_id: string
          created_at: string
          invited_by: string | null
          role: string
          user_id: string
        }
        Insert: {
          accepted_at?: string | null
          conference_id: string
          created_at?: string
          invited_by?: string | null
          role?: string
          user_id: string
        }
        Update: {
          accepted_at?: string | null
          conference_id?: string
          created_at?: string
          invited_by?: string | null
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organisers_conference_id_fkey"
            columns: ["conference_id"]
            isOneToOne: false
            referencedRelation: "conferences"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          digest: boolean
          digest_token: string | null
          email: string
          full_name: string
          id: string
          is_admin: boolean
          public_record: boolean
          role: string
          school: string
          theme: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          digest?: boolean
          digest_token?: string | null
          email?: string
          full_name?: string
          id: string
          is_admin?: boolean
          public_record?: boolean
          role?: string
          school?: string
          theme?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          digest?: boolean
          digest_token?: string | null
          email?: string
          full_name?: string
          id?: string
          is_admin?: boolean
          public_record?: boolean
          role?: string
          school?: string
          theme?: string
          updated_at?: string
        }
        Relationships: []
      }
      registrations: {
        Row: {
          conference_id: string
          contact_email: string
          contact_name: string
          created_at: string
          delegates: number
          emailed_status: string | null
          id: string
          notes: string | null
          redacted_at: string | null
          school: string
          status: string
          status_changed_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          conference_id: string
          contact_email: string
          contact_name: string
          created_at?: string
          delegates: number
          emailed_status?: string | null
          id?: string
          notes?: string | null
          redacted_at?: string | null
          school: string
          status?: string
          status_changed_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          conference_id?: string
          contact_email?: string
          contact_name?: string
          created_at?: string
          delegates?: number
          emailed_status?: string | null
          id?: string
          notes?: string | null
          redacted_at?: string | null
          school?: string
          status?: string
          status_changed_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "registrations_conference_id_fkey"
            columns: ["conference_id"]
            isOneToOne: false
            referencedRelation: "conferences"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          conference_id: string
          created_at: string
          id: number
          note: string
          reason: string
          reply_to: string
          reporter: string | null
          resolved_at: string | null
          status: string
        }
        Insert: {
          conference_id: string
          created_at?: string
          id?: never
          note?: string
          reason: string
          reply_to?: string
          reporter?: string | null
          resolved_at?: string | null
          status?: string
        }
        Update: {
          conference_id?: string
          created_at?: string
          id?: never
          note?: string
          reason?: string
          reply_to?: string
          reporter?: string | null
          resolved_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_conference_id_fkey"
            columns: ["conference_id"]
            isOneToOne: false
            referencedRelation: "conferences"
            referencedColumns: ["id"]
          },
        ]
      }
      role_alerts: {
        Row: {
          created_at: string
          kinds: string[]
          token: string
          user_id: string
        }
        Insert: {
          created_at?: string
          kinds: string[]
          token?: string
          user_id: string
        }
        Update: {
          created_at?: string
          kinds?: string[]
          token?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_organiser: { Args: { conf: string }; Returns: undefined }
      add_chamber_member: {
        Args: { cid: string; invitee_email: string }
        Returns: string
      }
      admin_chamber_state: { Args: { cid: string }; Returns: Json }
      admin_chambers: {
        Args: never
        Returns: {
          created_at: string
          id: string
          join_code: string
          members: number
          my_role: string
          name: string
          owner_email: string
          owner_name: string
          summary: Json
          updated_at: string
          version: number
        }[]
      }
      admin_claims: {
        Args: never
        Returns: {
          conference: string
          conference_id: string
          created_at: string
          email: string
          id: string
          name: string
          proof: string
          role: string
          slug: string
          status: string
          user_id: string
        }[]
      }
      admin_clear_errors: { Args: never; Returns: undefined }
      admin_conferences: {
        Args: never
        Returns: {
          chair_opens_at: string | null
          chair_url: string | null
          claimable: boolean | null
          collex_applications: boolean
          collex_registration: boolean
          committees: Json
          contact: string
          cover_path: string | null
          cover_x: number | null
          cover_y: number | null
          created_at: string
          delegates: string
          delegation_opens_at: string | null
          delegation_url: string | null
          end_date: string | null
          fee: string
          guides: Json
          host: string
          id: string
          interest_url: string | null
          key_dates: Json
          level: string | null
          name: string
          overview: string
          published_at: string | null
          review_note: string
          roles: Json
          schedule: Json
          secretariat: Json
          short_name: string
          slug: string | null
          start_date: string | null
          status: string
          submitted_by: string | null
          submitter_role: string
          thumb_path: string | null
          thumb_x: number | null
          thumb_y: number | null
          updated_at: string
          venue: string
          verified: boolean
        }[]
        SetofOptions: {
          from: "*"
          to: "conferences"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      admin_edit_chamber: {
        Args: {
          cid: string
          new_name: string
          new_state?: Json
          new_topic: string
        }
        Returns: undefined
      }
      admin_errors: { Args: never; Returns: Json }
      admin_health: { Args: never; Returns: Json }
      admin_hits: { Args: { days?: number }; Returns: Json }
      admin_join_chamber: { Args: { cid: string }; Returns: string }
      allocate_applications: {
        Args: { allocations: Json; conf: string }
        Returns: number
      }
      apply_to_conference: {
        Args: {
          app_kind: string
          app_note: string
          app_prefs: Json
          app_role: string
          conf: string
          person_experience: string
          person_name: string
          person_school: string
          person_year: string
        }
        Returns: string
      }
      chamber_code: { Args: { action: string; cid: string }; Returns: string }
      chamber_devices: { Args: { action: string; cid: string }; Returns: Json }
      chamber_link: { Args: { cid: string }; Returns: Json }
      chamber_team: {
        Args: { cid: string }
        Returns: {
          email: string
          is_owner: boolean
          name: string
          role: string
          user_id: string
        }[]
      }
      check_in: { Args: { token: string }; Returns: Json }
      claim_listing: {
        Args: { conf: string; your_proof: string; your_role: string }
        Returns: string
      }
      conference_wall: { Args: { conf: string }; Returns: Json }
      confirm_place: { Args: { app: string }; Returns: undefined }
      create_chamber: { Args: { initial: Json }; Returns: string }
      decide_claim: {
        Args: { approve: boolean; claim: string }
        Returns: undefined
      }
      delegate_record: { Args: { uid: string }; Returns: Json }
      delete_announcement: { Args: { ann: string }; Returns: undefined }
      delete_chamber: { Args: { cid: string }; Returns: undefined }
      delete_my_account: { Args: never; Returns: undefined }
      delete_user: { Args: { target: string }; Returns: undefined }
      hit: { Args: { first: boolean; page: string }; Returns: undefined }
      interest_counts: {
        Args: never
        Returns: {
          conference_id: string
          interested: number
        }[]
      }
      interest_weekly: {
        Args: never
        Returns: {
          conference_id: string
          interested: number
          week: string
        }[]
      }
      invite_organiser: {
        Args: { as_role?: string; conf: string; invitee_email: string }
        Returns: string
      }
      join_chamber: { Args: { code: string }; Returns: string }
      link_chamber: {
        Args: { cid: string; committee_name: string; conf: string }
        Returns: undefined
      }
      listing_followers: { Args: { conf: string }; Returns: number }
      listing_history: {
        Args: { conf: string }
        Returns: {
          action: string
          at: string
          can_undo: boolean
          fields: Json
          id: number
          note: string
          role: string
          subject: string
          who: string
        }[]
      }
      marks_released: { Args: { cid: string }; Returns: Json }
      my_chambers: {
        Args: never
        Returns: {
          delegates: number
          id: string
          is_owner: boolean
          members: number
          name: string
          owner_name: string
          role: string
          rules: string
          step: string
          topic: string
          updated_at: string
        }[]
      }
      my_conferences: {
        Args: never
        Returns: {
          committees: Json
          id: string
          name: string
          slug: string
        }[]
      }
      my_feedback: { Args: never; Returns: Json }
      my_invites: {
        Args: never
        Returns: {
          conference: string
          conference_id: string
          created_at: string
          invited_by: string
          role: string
        }[]
      }
      my_listings: {
        Args: never
        Returns: {
          chair_opens_at: string | null
          chair_url: string | null
          claimable: boolean | null
          collex_applications: boolean
          collex_registration: boolean
          committees: Json
          contact: string
          cover_path: string | null
          cover_x: number | null
          cover_y: number | null
          created_at: string
          delegates: string
          delegation_opens_at: string | null
          delegation_url: string | null
          end_date: string | null
          fee: string
          guides: Json
          host: string
          id: string
          interest_url: string | null
          key_dates: Json
          level: string | null
          name: string
          overview: string
          published_at: string | null
          review_note: string
          roles: Json
          schedule: Json
          secretariat: Json
          short_name: string
          slug: string | null
          start_date: string | null
          status: string
          submitted_by: string | null
          submitter_role: string
          thumb_path: string | null
          thumb_x: number | null
          thumb_y: number | null
          updated_at: string
          venue: string
          verified: boolean
        }[]
        SetofOptions: {
          from: "*"
          to: "conferences"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      my_seats: {
        Args: never
        Returns: {
          delegate: string
          id: string
          name: string
          topic: string
          updated_at: string
        }[]
      }
      note_chamber_started: {
        Args: { label: string; procedure: string }
        Returns: undefined
      }
      open_chamber: { Args: { cid: string; known?: number }; Returns: Json }
      organisers_of: {
        Args: { conf: string }
        Returns: {
          accepted: boolean
          email: string
          is_owner: boolean
          name: string
          role: string
          user_id: string
        }[]
      }
      post_announcement: {
        Args: { conf: string; note: string }
        Returns: string
      }
      register_delegation: {
        Args: {
          conf: string
          delegate_count: number
          note?: string
          person_email: string
          person_name: string
          school_name: string
        }
        Returns: string
      }
      release_marks: { Args: { cid: string }; Returns: number }
      remove_chamber_member: {
        Args: { cid: string; target: string }
        Returns: undefined
      }
      remove_organiser: {
        Args: { conf: string; target: string }
        Returns: undefined
      }
      report_error: {
        Args: { agent: string; message: string; page: string; stack: string }
        Returns: undefined
      }
      report_listing: {
        Args: { conf: string; note?: string; reason: string; reply_to?: string }
        Returns: undefined
      }
      room_approve_seat: {
        Args: { cid: string; target: string }
        Returns: undefined
      }
      room_ask: {
        Args: { body: Json; cid: string; kind: string }
        Returns: string
      }
      room_ask_set: {
        Args: { ask: string; new_status: string }
        Returns: undefined
      }
      room_chair: { Args: { cid: string }; Returns: Json }
      room_clear_votes: {
        Args: { cid: string; vote_key: string }
        Returns: undefined
      }
      room_file_add: {
        Args: {
          cid: string
          file_name: string
          file_path: string
          file_size: number
        }
        Returns: string
      }
      room_file_remove: { Args: { file: string }; Returns: string }
      room_note: {
        Args: { body: string; cid: string; to_whom: string }
        Returns: undefined
      }
      room_peek: { Args: { code: string }; Returns: Json }
      room_set: { Args: { cid: string; new_room: Json }; Returns: undefined }
      room_sync: { Args: { cid: string; known?: number }; Returns: Json }
      room_take_seat: {
        Args: { code: string; delegate: string }
        Returns: string
      }
      room_unseat: { Args: { cid: string; target: string }; Returns: undefined }
      room_vote: {
        Args: { ballot: string; cid: string; vote_key: string }
        Returns: undefined
      }
      save_chamber: {
        Args: { cid: string; expected: number; new_state: Json }
        Returns: Json
      }
      send_allocations: { Args: { conf: string }; Returns: number }
      send_broadcast: {
        Args: {
          conf: string
          mail_body: string
          mail_subject: string
          to_audience: string
        }
        Returns: number
      }
      send_broadcast_test: {
        Args: { conf: string; mail_body: string; mail_subject: string }
        Returns: string
      }
      set_admin: {
        Args: { make_admin: boolean; target: string }
        Returns: undefined
      }
      set_application: {
        Args: { app: string; new_status: string }
        Returns: undefined
      }
      set_checked_in: {
        Args: { app: string; arrived: boolean }
        Returns: undefined
      }
      set_digest: { Args: { turn_on: boolean }; Returns: undefined }
      set_organiser_role: {
        Args: { conf: string; new_role: string; target: string }
        Returns: undefined
      }
      set_registration_status: {
        Args: { new_status: string; reg: string }
        Returns: undefined
      }
      set_role_alert: { Args: { alert_kinds: string[] }; Returns: undefined }
      team_applications: {
        Args: { conf: string }
        Returns: {
          allocation_sent_at: string
          checked_in_at: string
          committee: string
          conference_id: string
          confirmed_at: string
          country: string
          created_at: string
          id: string
          kind: string
          name: string
          role_title: string
          school: string
          status: string
          year: string
        }[]
      }
      team_registrations: {
        Args: { conf: string }
        Returns: {
          conference_id: string
          contact_name: string
          created_at: string
          delegates: number
          id: string
          school: string
          status: string
        }[]
      }
      undo_edit: { Args: { entry: number }; Returns: undefined }
      unfollow: { Args: { t: string }; Returns: string }
      unsubscribe: { Args: { t: string }; Returns: Json }
      withdraw_application: { Args: { app: string }; Returns: undefined }
      withdraw_marks: { Args: { cid: string }; Returns: undefined }
      withdraw_registration: { Args: { reg: string }; Returns: undefined }
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
