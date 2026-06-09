/* eslint-disable @typescript-eslint/no-explicit-any */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// ─── Local type (matches workspace_branches table schema) ─────────────────────

export interface WorkspaceBranch {
  id: string;
  workspace_id: string;
  asset_owner_id: string | null;
  display_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  notes: string | null;
  is_active: boolean;
  is_amc: boolean;
  created_at: string;
  updated_at: string;
  // joined from asset_owners:
  asset_owner_name?: string;
  asset_owner_address?: string;
}

export interface BranchMetrics {
  asset_owner_id: string;
  total_assets: number;
  upcoming_auctions: number;
}

export type BranchPatch = Partial<Pick<WorkspaceBranch, "display_name" | "contact_phone" | "contact_email" | "notes" | "is_active" | "is_amc">>;

export interface BranchInput {
  display_name: string;
  contact_phone?: string | null;
  contact_email?: string | null;
  notes?: string | null;
  is_amc?: boolean;
}

// ─── AMC heuristic (mirrors useAssetOwnerWorkspace) ──────────────────────────

function isAmc(name: string): boolean {
  const n = name.toLowerCase();
  return n.includes("amc") || n.includes("quản lý nợ") || n.includes("khai thác tài sản") || n.includes("quản lý tài sản");
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useWorkspaceBranches(workspaceId: string | null) {
  const qc = useQueryClient();
  const branchesKey = ["workspace_branches", workspaceId];
  const claimsKey = ["workspace_branch_claims", workspaceId];

  // ── Branches ─────────────────────────────────────────────────────────────

  const { data: branches = [], isLoading: branchesLoading } = useQuery<WorkspaceBranch[]>({
    queryKey: branchesKey,
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("workspace_branches")
        .select("*, asset_owner:asset_owners(name, address)")
        .eq("workspace_id", workspaceId!)
        .order("is_amc", { ascending: true })
        .order("is_active", { ascending: false })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((row: any) => ({
        ...row,
        asset_owner_name: row.asset_owner?.name ?? null,
        asset_owner_address: row.asset_owner?.address ?? null,
        asset_owner: undefined,
      }));
    },
  });

  // ── Claims (for computing metrics) ───────────────────────────────────────

  const { data: claimsRaw = [] } = useQuery<{ asset_owner_id: string | null; status: string; auction_date: string | null }[]>({
    queryKey: claimsKey,
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("asset_owner_claims")
        .select("asset_owner_id, status, listing:listings(custom_attributes)")
        .eq("workspace_id", workspaceId!)
        .neq("status", "rejected");
      if (error) throw error;
      return (data ?? []).map((row: any) => {
        const ca = row.listing?.custom_attributes as Record<string, any> | null;
        const aDate: string | null = ca?.auction_date ?? ca?.auction_time ?? null;
        return {
          asset_owner_id: row.asset_owner_id,
          status: row.status,
          auction_date: aDate,
        };
      });
    },
  });

  // Compute metrics per asset_owner_id
  const metrics: Record<string, BranchMetrics> = {};
  const today = new Date().toISOString().slice(0, 10);
  for (const c of claimsRaw) {
    if (!c.asset_owner_id) continue;
    if (!metrics[c.asset_owner_id]) {
      metrics[c.asset_owner_id] = { asset_owner_id: c.asset_owner_id, total_assets: 0, upcoming_auctions: 0 };
    }
    metrics[c.asset_owner_id].total_assets++;
    if (c.auction_date && c.auction_date.slice(0, 10) >= today) {
      metrics[c.asset_owner_id].upcoming_auctions++;
    }
  }

  // ── Sync from claims ─────────────────────────────────────────────────────

  const syncFromClaims = useMutation({
    mutationFn: async () => {
      if (!workspaceId) throw new Error("no_workspace");
      // Get distinct asset_owner_ids from claims
      const { data: claims, error } = await supabase
        .from("asset_owner_claims")
        .select("asset_owner_id, matched_name, asset_owner:asset_owners(name)")
        .eq("workspace_id", workspaceId)
        .neq("status", "rejected")
        .not("asset_owner_id", "is", null);
      if (error) throw error;

      // Deduplicate by asset_owner_id
      const seen = new Set<string>();
      const toInsert: any[] = [];
      for (const c of claims ?? []) {
        if (!c.asset_owner_id || seen.has(c.asset_owner_id)) continue;
        seen.add(c.asset_owner_id);
        const name: string = (c.asset_owner as any)?.name ?? c.matched_name ?? "";
        toInsert.push({
          workspace_id: workspaceId,
          asset_owner_id: c.asset_owner_id,
          is_amc: isAmc(name),
        });
      }

      if (toInsert.length > 0) {
        await (supabase as any)
          .from("workspace_branches")
          .upsert(toInsert, { onConflict: "workspace_id,asset_owner_id", ignoreDuplicates: true });
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: branchesKey }),
    onError: () => toast.error("Đồng bộ chi nhánh thất bại"),
  });

  // ── Create branch ─────────────────────────────────────────────────────────

  const createBranch = useMutation({
    mutationFn: async (input: BranchInput) => {
      if (!workspaceId) throw new Error("no_workspace");
      const { error } = await (supabase as any)
        .from("workspace_branches")
        .insert({
          workspace_id: workspaceId,
          display_name: input.display_name,
          contact_phone: input.contact_phone ?? null,
          contact_email: input.contact_email ?? null,
          notes: input.notes ?? null,
          is_amc: input.is_amc ?? false,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: branchesKey });
      toast.success("Đã thêm chi nhánh");
    },
    onError: () => toast.error("Thêm chi nhánh thất bại"),
  });

  // ── Bulk create branches (import) ─────────────────────────────────────────

  const bulkCreateBranches = useMutation({
    mutationFn: async (inputs: BranchInput[]) => {
      if (!workspaceId) throw new Error("no_workspace");
      const rows = inputs.map((input) => ({
        workspace_id: workspaceId,
        display_name: input.display_name,
        contact_phone: input.contact_phone ?? null,
        contact_email: input.contact_email ?? null,
        notes: input.notes ?? null,
        is_amc: input.is_amc ?? false,
      }));
      const { error } = await (supabase as any)
        .from("workspace_branches")
        .insert(rows);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: branchesKey });
    },
    onError: () => toast.error("Import chi nhánh thất bại"),
  });

  // ── Delete branch ─────────────────────────────────────────────────────────

  const deleteBranch = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("workspace_branches")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: branchesKey });
      toast.success("Đã xoá chi nhánh");
    },
    onError: () => toast.error("Xoá thất bại"),
  });

  // ── Update branch ─────────────────────────────────────────────────────────

  const updateBranch = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: BranchPatch }) => {
      const { error } = await (supabase as any)
        .from("workspace_branches")
        .update(patch)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: branchesKey });
      toast.success("Đã cập nhật");
    },
    onError: () => toast.error("Cập nhật thất bại"),
  });

  // ── Toggle active ─────────────────────────────────────────────────────────

  const toggleActive = useMutation({
    mutationFn: async (branch: WorkspaceBranch) => {
      const newActive = !branch.is_active;
      const { error } = await (supabase as any)
        .from("workspace_branches")
        .update({ is_active: newActive })
        .eq("id", branch.id);
      if (error) throw error;
      return { branch, newActive };
    },
    onSuccess: ({ newActive }) => {
      qc.invalidateQueries({ queryKey: branchesKey });
      toast.success(newActive ? "Đã kích hoạt chi nhánh" : "Đã tắt chi nhánh");
    },
    onError: () => toast.error("Thao tác thất bại"),
  });

  return {
    branches,
    branchesLoading,
    metrics,
    syncFromClaims,
    createBranch,
    bulkCreateBranches,
    deleteBranch,
    updateBranch,
    toggleActive,
  };
}
