import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type {
  Advertisement,
  AdvertisementUpsert,
  AdDailyStat,
  AdStatus,
  StatDevice,
} from "@/types/advertising";

// Truy cập qua untyped cast — cùng convention với useCampaigns.ts / useArticles.ts.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const adsTable = () => (supabase as any).from("advertisements");
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const statsTable = () => (supabase as any).from("ad_daily_stats");

const AD_SELECT =
  "*, position:ad_positions(id,name,placement_type,price,page_id,page:ad_pages(id,name)), customer:customers(id,name,code)";

// ─── Reads ───────────────────────────────────────────────────────────────────

export function useAdvertisements() {
  return useQuery<Advertisement[]>({
    queryKey: ["advertisements"],
    queryFn: async () => {
      const { data, error } = await adsTable()
        .select(AD_SELECT)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Advertisement[];
    },
  });
}

export function useAdvertisement(id?: string) {
  return useQuery<Advertisement>({
    queryKey: ["advertisement", id],
    queryFn: async () => {
      const { data, error } = await adsTable().select(AD_SELECT).eq("id", id).single();
      if (error) throw error;
      return data as Advertisement;
    },
    enabled: !!id,
  });
}

export interface AdStatsFilter {
  days: number;
  device: StatDevice | "all";
}

export function useAdDailyStats(adId: string | undefined, filter: AdStatsFilter) {
  return useQuery<AdDailyStat[]>({
    queryKey: ["ad_daily_stats", adId, filter.days, filter.device],
    queryFn: async () => {
      const from = new Date(Date.now() - (filter.days - 1) * 86_400_000)
        .toISOString()
        .slice(0, 10);
      let q = statsTable().select("*").eq("advertisement_id", adId).gte("stat_date", from);
      if (filter.device !== "all") q = q.eq("device", filter.device);
      const { data, error } = await q.order("stat_date", { ascending: true });
      if (error) throw error;
      return (data ?? []) as AdDailyStat[];
    },
    enabled: !!adId,
  });
}

// Banner của 1 khách hàng (dùng ở trang chi tiết khách hàng).
export function useCustomerAdvertisements(customerId?: string) {
  return useQuery<Advertisement[]>({
    queryKey: ["advertisements", "by-customer", customerId],
    queryFn: async () => {
      const { data, error } = await adsTable()
        .select(AD_SELECT)
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Advertisement[];
    },
    enabled: !!customerId,
  });
}

// ─── Writes ──────────────────────────────────────────────────────────────────

/** Lỗi trigger vị trí unique trả về message tiếng Việt — nhận diện để toast rõ. */
export function isUniquePositionError(err: unknown): boolean {
  const msg = (err as { message?: string })?.message ?? "";
  return msg.includes("Vị trí duy nhất");
}

export function useUpsertAdvertisement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: AdvertisementUpsert) => {
      if (id) {
        const { data, error } = await adsTable()
          .update(payload)
          .eq("id", id)
          .select()
          .single();
        if (error) throw error;
        return data as Advertisement;
      }
      const { data, error } = await adsTable().insert(payload).select().single();
      if (error) throw error;
      return data as Advertisement;
    },
    onSuccess: (data: Advertisement) => {
      qc.invalidateQueries({ queryKey: ["advertisements"] });
      qc.invalidateQueries({ queryKey: ["advertisement", data.id] });
    },
  });
}

export function useDeleteAdvertisement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await adsTable().delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["advertisements"] }),
  });
}

export function useUpdateAdStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: AdStatus }) => {
      const { error } = await adsTable().update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_res, { id }: { id: string; status: AdStatus }) => {
      qc.invalidateQueries({ queryKey: ["advertisements"] });
      qc.invalidateQueries({ queryKey: ["advertisement", id] });
    },
  });
}
