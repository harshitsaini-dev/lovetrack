/**
 * Hand-maintained database types.
 *
 * The shape here must match what `supabase gen types` produces, because
 * supabase-js uses it to infer query results. Once the schema settles,
 * regenerate instead of editing by hand:
 *   npx supabase gen types typescript --project-id <ref> > types/database.ts
 */

export type UserRole = "user" | "admin";
export type AccountStatus = "active" | "suspended";

// Declared as a `type`, not an `interface`, on purpose: supabase-js requires
// each Row to satisfy Record<string, unknown>, and interfaces do not get an
// implicit index signature — using one silently breaks query type inference.
export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: UserRole;
  status: AccountStatus;
  notify_check_in: boolean;
  notify_lunch: boolean;
  notify_check_out: boolean;
  notify_leave: boolean;
  notify_reminder: boolean;
  /** Local "HH:MM:SS" for the daily reminder, read in `timezone`. */
  reminder_time: string;
  timezone: string;
  created_at: string;
  updated_at: string;
};

/** Columns a user is allowed to change on their own profile. */
export type ProfileUpdate = Partial<
  Pick<
    Profile,
    | "full_name"
    | "avatar_url"
    | "notify_check_in"
    | "notify_lunch"
    | "notify_check_out"
    | "notify_leave"
    | "notify_reminder"
    | "reminder_time"
    | "timezone"
  >
>;

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Pick<Profile, "id" | "email"> &
          Partial<Omit<Profile, "id" | "email">>;
        Update: ProfileUpdate;
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey";
            columns: ["id"];
            isOneToOne: true;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<never, never>;
    Functions: {
      is_admin: {
        Args: { check_user_id?: string };
        Returns: boolean;
      };
    };
    Enums: {
      user_role: UserRole;
      account_status: AccountStatus;
    };
    CompositeTypes: Record<never, never>;
  };
};
