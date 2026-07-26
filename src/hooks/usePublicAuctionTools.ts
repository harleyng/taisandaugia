import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type {
  AuctionTool,
  AuctionToolProvider,
  PublicShowcase,
  RequestToolServiceResult,
} from "@/types/auctionTools";

// Truy cập qua untyped cast — cùng convention với usePartners.ts.
/* eslint-disable @typescript-eslint/no-explicit-any */
const toolsTable = () => (supabase as any).from("auction_tools");
const providersTable = () => (supabase as any).from("auction_tool_providers");
const rpc = (fn: string, args: Record<string, unknown>) => (supabase as any).rpc(fn, args);
/* eslint-enable @typescript-eslint/no-explicit-any */

// Chỉ cột trình bày (RLS public_read đã lọc is_active / status='active').
const PROVIDER_PUBLIC_SELECT =
  "id,tool_id,name,slug,is_own,logo_url,tagline,description,website,price_label,sort_order,service_id,tool:auction_tools(id,key,name,slug)";

/** 4 công cụ + provider công khai (một truy vấn, gom client-side theo tool). */
export function usePublicTools() {
  return useQuery<{ tools: AuctionTool[]; providers: AuctionToolProvider[] }>({
    queryKey: ["auction-tools", "public"],
    queryFn: async () => {
      const [toolsRes, provRes] = await Promise.all([
        toolsTable().select("*").eq("is_active", true).order("sort_order"),
        providersTable().select(PROVIDER_PUBLIC_SELECT).eq("status", "active").order("sort_order"),
      ]);
      if (toolsRes.error) throw toolsRes.error;
      if (provRes.error) throw provRes.error;
      return {
        tools: (toolsRes.data ?? []) as AuctionTool[],
        providers: (provRes.data ?? []) as AuctionToolProvider[],
      };
    },
  });
}

export function useProviderBySlug(slug?: string) {
  return useQuery<AuctionToolProvider | null>({
    queryKey: ["tool-provider", "public", slug],
    queryFn: async () => {
      const { data, error } = await providersTable()
        .select(PROVIDER_PUBLIC_SELECT)
        .eq("slug", slug)
        .eq("status", "active")
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as AuctionToolProvider | null;
    },
    enabled: !!slug,
  });
}

/** Showcase công khai qua RPC — url chỉ có với showcase public, còn lại is_locked. */
export function usePublicShowcases(providerId?: string) {
  return useQuery<PublicShowcase[]>({
    queryKey: ["tool-showcases", "public", providerId],
    queryFn: async () => {
      const { data, error } = await rpc("list_tool_showcases", { _provider_id: providerId });
      if (error) throw error;
      return (data ?? []) as PublicShowcase[];
    },
    enabled: !!providerId,
  });
}

export function useUnlockShowcase() {
  return useMutation<string, Error, { id: string; password: string }>({
    mutationFn: async ({ id, password }) => {
      const { data, error } = await rpc("unlock_tool_showcase", { _id: id, _password: password });
      if (error) throw error;
      return data as string;
    },
  });
}

export function useRequestToolService() {
  return useMutation<RequestToolServiceResult, Error, { providerId: string; note?: string }>({
    mutationFn: async ({ providerId, note }) => {
      const { data, error } = await rpc("request_tool_service", {
        _provider_id: providerId,
        _note: note ?? null,
      });
      if (error) throw error;
      return data as RequestToolServiceResult;
    },
  });
}
