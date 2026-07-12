import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { InvoiceInfo } from "@/lib/credits";
import type {
  AdminUser,
  AdminUserStats,
  AdminUserTransaction,
  AdminUserUnlocks,
} from "@/types/adminUser";

// ─── Reads ───────────────────────────────────────────────────────────────────

const PROFILE_COLS =
  "id,email,name,created_at,activated,activated_at,status,kyc_status,notifications_enabled,invoice_info";

// Admin can now read all user_credits / user_roles (admin-read RLS), so we join
// client-side across three small tables instead of relying on PostgREST embeds.
export function useAdminUsers() {
  return useQuery<AdminUser[]>({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const [profilesRes, creditsRes, rolesRes] = await Promise.all([
        supabase.from("profiles").select(PROFILE_COLS).order("created_at", { ascending: false }),
        supabase.from("user_credits").select("user_id,balance"),
        supabase.from("user_roles").select("user_id,role"),
      ]);
      if (profilesRes.error) throw profilesRes.error;

      const balanceByUser = new Map<string, number>();
      (creditsRes.data ?? []).forEach((r) => balanceByUser.set(r.user_id, r.balance));
      const adminUsers = new Set(
        (rolesRes.data ?? []).filter((r) => r.role === "ADMIN").map((r) => r.user_id),
      );

      return (profilesRes.data ?? []).map((p) => mapUser(p, balanceByUser.get(p.id) ?? 0, adminUsers.has(p.id)));
    },
  });
}

export function useAdminUser(id?: string) {
  return useQuery<AdminUser>({
    queryKey: ["admin-user", id],
    queryFn: async () => {
      const [profileRes, creditRes, rolesRes] = await Promise.all([
        supabase.from("profiles").select(PROFILE_COLS).eq("id", id!).single(),
        supabase.from("user_credits").select("balance").eq("user_id", id!).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", id!),
      ]);
      if (profileRes.error) throw profileRes.error;
      const isAdmin = (rolesRes.data ?? []).some((r) => r.role === "ADMIN");
      return mapUser(profileRes.data, creditRes.data?.balance ?? 0, isAdmin);
    },
    enabled: !!id,
  });
}

export function useAdminUserTransactions(id?: string) {
  return useQuery<AdminUserTransaction[]>({
    queryKey: ["admin-user-transactions", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("credit_transactions")
        .select("id,type,description,credit_delta,created_at")
        .eq("user_id", id!)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!id,
  });
}

export function useAdminUserUnlocks(id?: string) {
  return useQuery<AdminUserUnlocks>({
    queryKey: ["admin-user-unlocks", id],
    queryFn: async () => {
      const head = (table: "user_asset_unlocks" | "user_company_unlocks" | "user_owner_unlocks" | "user_report_unlocks") =>
        supabase.from(table).select("id", { count: "exact", head: true }).eq("user_id", id!);
      const [assets, companies, owners, reports] = await Promise.all([
        head("user_asset_unlocks"),
        head("user_company_unlocks"),
        head("user_owner_unlocks"),
        head("user_report_unlocks"),
      ]);
      return {
        assets: assets.count ?? 0,
        companies: companies.count ?? 0,
        owners: owners.count ?? 0,
        reports: reports.count ?? 0,
      };
    },
    enabled: !!id,
  });
}

// Stats: total/active/new derived from a lightweight profiles pull; monthly
// credit inflow summed from the ledger (SELECT is open to authenticated).
export function useAdminUserStats() {
  return useQuery<AdminUserStats>({
    queryKey: ["admin-user-stats"],
    queryFn: async () => {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

      const [profilesRes, txRes] = await Promise.all([
        supabase.from("profiles").select("created_at,activated,status"),
        supabase
          .from("credit_transactions")
          .select("credit_delta")
          .in("type", ["purchase", "admin_grant"])
          .gte("created_at", startOfMonth),
      ]);
      const profiles = profilesRes.data ?? [];
      return {
        total: profiles.length,
        active: profiles.filter((p) => p.activated && p.status !== "locked").length,
        newThisWeek: profiles.filter((p) => p.created_at >= weekAgo).length,
        newThisMonth: profiles.filter((p) => p.created_at >= startOfMonth).length,
        topupThisMonth: (txRes.data ?? []).reduce((sum, r) => sum + (r.credit_delta ?? 0), 0),
      };
    },
  });
}

// ─── Writes ──────────────────────────────────────────────────────────────────

function invalidateUser(qc: ReturnType<typeof useQueryClient>, id?: string) {
  qc.invalidateQueries({ queryKey: ["admin-users"] });
  qc.invalidateQueries({ queryKey: ["admin-user-stats"] });
  if (id) {
    qc.invalidateQueries({ queryKey: ["admin-user", id] });
    qc.invalidateQueries({ queryKey: ["admin-user-transactions", id] });
  }
}

// Read the JSON body of a failed functions.invoke error so we can surface the
// server's Vietnamese-friendly reason instead of a generic message.
export async function invokeMessage(error: unknown): Promise<string> {
  const ctx = (error as { context?: Response })?.context;
  try {
    const body = await ctx?.clone().json();
    return body?.message || body?.error || (error as Error)?.message || "Lỗi không xác định";
  } catch {
    return (error as Error)?.message || "Lỗi không xác định";
  }
}

export function useGrantCredits() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, amount, note }: { userId: string; amount: number; note?: string }) => {
      const { data, error } = await supabase.rpc("admin_grant_credits", {
        _user_id: userId,
        _amount: amount,
        _note: note ?? undefined,
      });
      if (error) throw error;
      return data as number;
    },
    onSuccess: (_res, vars) => invalidateUser(qc, vars.userId),
  });
}

export function useSetActivated() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, activated }: { userId: string; activated: boolean }) => {
      const { error } = await supabase
        .from("profiles")
        .update({ activated, activated_at: activated ? new Date().toISOString() : null })
        .eq("id", userId);
      if (error) throw error;
    },
    onSuccess: (_res, vars) => invalidateUser(qc, vars.userId),
  });
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ email, name, makeAdmin }: { email: string; name: string; makeAdmin?: boolean }) => {
      const { data, error } = await supabase.functions.invoke("admin-user-actions", {
        body: { action: "create", email, name, makeAdmin, redirectTo: `${window.location.origin}/tao-mat-khau` },
      });
      if (error) throw new Error(await invokeMessage(error));
      return data as { userId: string; email: string; actionLink: string | null };
    },
    onSuccess: () => invalidateUser(qc),
  });
}

export function useSetLock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, lock }: { userId: string; lock: boolean }) => {
      const { error } = await supabase.functions.invoke("admin-user-actions", {
        body: { action: lock ? "lock" : "unlock", userId },
      });
      if (error) throw new Error(await invokeMessage(error));
    },
    onSuccess: (_res, vars) => invalidateUser(qc, vars.userId),
  });
}

// Admin đặt lại mật khẩu cho user trực tiếp (không gửi email) — dùng service_role
// trong edge function.
export function useSetUserPassword() {
  return useMutation({
    mutationFn: async ({ userId, password }: { userId: string; password: string }) => {
      const { error } = await supabase.functions.invoke("admin-user-actions", {
        body: { action: "set_password", userId, password },
      });
      if (error) throw new Error(await invokeMessage(error));
    },
  });
}

// ─── Mapping ─────────────────────────────────────────────────────────────────

type ProfileRow = {
  id: string;
  email: string;
  name: string | null;
  created_at: string;
  activated: boolean;
  activated_at: string | null;
  status: string;
  kyc_status: string;
  notifications_enabled: boolean;
  invoice_info: unknown;
};

function mapUser(p: ProfileRow, balance: number, isAdmin: boolean): AdminUser {
  return {
    id: p.id,
    email: p.email,
    name: p.name,
    created_at: p.created_at,
    activated: p.activated,
    activated_at: p.activated_at,
    lockStatus: p.status === "locked" ? "locked" : "active",
    kyc_status: p.kyc_status,
    notifications_enabled: p.notifications_enabled,
    invoice_info: (p.invoice_info as InvoiceInfo | null) ?? null,
    balance,
    isAdmin,
  };
}
