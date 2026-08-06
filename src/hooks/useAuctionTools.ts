import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type {
  AuctionTool,
  AuctionToolUpsert,
  AuctionToolProvider,
  AuctionToolProviderUpsert,
  AuctionToolShowcase,
  AuctionToolShowcaseUpsert,
} from "@/types/auctionTools";
import { qk } from "@/lib/queryKeys";

// Truy cập qua untyped cast — cùng convention với useSuppliers.ts / useOrders.ts.
/* eslint-disable @typescript-eslint/no-explicit-any */
const toolsTable = () => (supabase as any).from("auction_tools");
const providersTable = () => (supabase as any).from("auction_tool_providers");
const showcasesTable = () => (supabase as any).from("auction_tool_showcases");
/* eslint-enable @typescript-eslint/no-explicit-any */

const PROVIDER_SELECT =
  "*, tool:auction_tools(id,key,name,slug), supplier:suppliers(id,name,code), service:services(id,name,kind)";

// ─── Tools ─────────────────────────────────────────────────────────────────

export function useAuctionTools() {
  return useQuery<AuctionTool[]>({
    queryKey: qk.auctionTools.all,
    queryFn: async () => {
      const { data, error } = await toolsTable().select("*").order("sort_order");
      if (error) throw error;
      return (data ?? []) as AuctionTool[];
    },
  });
}

export function useUpsertTool() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: AuctionToolUpsert) => {
      if (!id) throw new Error("Công cụ chỉ sửa được, không tạo mới");
      const { data, error } = await toolsTable().update(payload).eq("id", id).select().single();
      if (error) throw error;
      return data as AuctionTool;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.auctionTools.all });
      qc.invalidateQueries({ queryKey: qk.auctionTools.public });
    },
  });
}

// ─── Providers ───────────────────────────────────────────────────────────────

export function useToolProviders() {
  return useQuery<AuctionToolProvider[]>({
    queryKey: ["tool-providers"],
    queryFn: async () => {
      const { data, error } = await providersTable()
        .select(PROVIDER_SELECT)
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as AuctionToolProvider[];
    },
  });
}

/** Xoá provider còn showcase → CASCADE xoá showcase; còn opportunity trỏ về → SET NULL. */
export function isProviderInUseError(err: unknown): boolean {
  const e = err as { code?: string; message?: string };
  return e?.code === "23503" || (e?.message ?? "").includes("violates foreign key");
}

export function useUpsertProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: AuctionToolProviderUpsert) => {
      if (id) {
        const { data, error } = await providersTable().update(payload).eq("id", id).select().single();
        if (error) throw error;
        return data as AuctionToolProvider;
      }
      const { data, error } = await providersTable().insert(payload).select().single();
      if (error) throw error;
      return data as AuctionToolProvider;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tool-providers"] });
      qc.invalidateQueries({ queryKey: qk.auctionTools.public });
    },
  });
}

export function useDeleteProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await providersTable().delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tool-providers"] }),
  });
}

// ─── Showcases (admin đọc/ghi bảng gốc; MKP đọc qua RPC) ─────────────────────

export function useProviderShowcases(providerId?: string) {
  return useQuery<AuctionToolShowcase[]>({
    queryKey: qk.toolShowcases.byProvider(providerId),
    queryFn: async () => {
      const { data, error } = await showcasesTable()
        .select("*")
        .eq("provider_id", providerId)
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as AuctionToolShowcase[];
    },
    enabled: !!providerId,
  });
}

export function useUpsertShowcase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: AuctionToolShowcaseUpsert) => {
      if (id) {
        const { data, error } = await showcasesTable().update(payload).eq("id", id).select().single();
        if (error) throw error;
        return data as AuctionToolShowcase;
      }
      const { data, error } = await showcasesTable().insert(payload).select().single();
      if (error) throw error;
      return data as AuctionToolShowcase;
    },
    onSuccess: (data: AuctionToolShowcase) => {
      qc.invalidateQueries({ queryKey: qk.toolShowcases.byProvider(data.provider_id) });
      qc.invalidateQueries({ queryKey: ["tool-providers"] });
    },
  });
}

export function useDeleteShowcase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string; providerId: string }) => {
      const { error } = await showcasesTable().delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: qk.toolShowcases.byProvider(vars.providerId) });
      qc.invalidateQueries({ queryKey: ["tool-providers"] });
    },
  });
}
