import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Order, OrderUpsert } from "@/types/orders";

// Truy cập qua untyped cast — cùng convention với useCustomers.ts / useAdvertisements.ts.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ordersTable = () => (supabase as any).from("orders");

const ORDER_SELECT =
  "*, customer:customers(id,name,code), service:services(id,name,kind), advertisement:advertisements(id,code,name,status)";

// ─── Reads ───────────────────────────────────────────────────────────────────

export function useOrders() {
  return useQuery<Order[]>({
    queryKey: ["orders"],
    queryFn: async () => {
      const { data, error } = await ordersTable()
        .select(ORDER_SELECT)
        .order("ordered_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Order[];
    },
  });
}

export function useOrder(id?: string) {
  return useQuery<Order>({
    queryKey: ["order", id],
    queryFn: async () => {
      const { data, error } = await ordersTable().select(ORDER_SELECT).eq("id", id).single();
      if (error) throw error;
      return data as Order;
    },
    enabled: !!id,
  });
}

// Đơn hàng của 1 khách hàng (dùng ở trang chi tiết khách hàng).
export function useCustomerOrders(customerId?: string) {
  return useQuery<Order[]>({
    queryKey: ["orders", "by-customer", customerId],
    queryFn: async () => {
      const { data, error } = await ordersTable()
        .select(ORDER_SELECT)
        .eq("customer_id", customerId)
        .order("ordered_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Order[];
    },
    enabled: !!customerId,
  });
}

// Đơn hàng gắn với 1 banner quảng cáo (truy vết ngược từ chi tiết quảng cáo).
export function useAdvertisementOrders(advertisementId?: string) {
  return useQuery<Order[]>({
    queryKey: ["orders", "by-advertisement", advertisementId],
    queryFn: async () => {
      const { data, error } = await ordersTable()
        .select(ORDER_SELECT)
        .eq("advertisement_id", advertisementId)
        .order("ordered_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Order[];
    },
    enabled: !!advertisementId,
  });
}

// ─── Writes ──────────────────────────────────────────────────────────────────

/** Lỗi trigger chặn đặt đơn vào dịch vụ credit — nhận diện để toast rõ. */
export function isDirectServiceError(err: unknown): boolean {
  const msg = (err as { message?: string })?.message ?? "";
  return msg.includes("dịch vụ bán trực tiếp");
}

export function useUpsertOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: OrderUpsert) => {
      if (id) {
        const { data, error } = await ordersTable()
          .update(payload)
          .eq("id", id)
          .select()
          .single();
        if (error) throw error;
        return data as Order;
      }
      const { data, error } = await ordersTable().insert(payload).select().single();
      if (error) throw error;
      return data as Order;
    },
    onSuccess: (data: Order) => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["order", data.id] });
      qc.invalidateQueries({ queryKey: ["orders", "by-customer", data.customer_id] });
    },
  });
}

export function useDeleteOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await ordersTable().delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["orders"] }),
  });
}
