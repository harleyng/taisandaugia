import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Order, OrderUpsert } from "@/types/orders";
import { qk } from "@/lib/queryKeys";

// Truy cập qua untyped cast — cùng convention với useCustomers.ts / useAdvertisements.ts.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ordersTable = () => (supabase as any).from("orders");

const ORDER_SELECT =
  "*, customer:customers(id,name,code), service:services(id,name,kind), supplier:suppliers(id,name,code), advertisement:advertisements(id,code,name,status)";

// ─── Reads ───────────────────────────────────────────────────────────────────

export function useOrders() {
  return useQuery<Order[]>({
    queryKey: qk.orders.all,
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
    queryKey: qk.orders.byCustomer(customerId),
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

/** Toàn bộ đơn của một khách hàng: hợp đơn dịch vụ (customer_id) VÀ đơn nạp
 *  credit của tài khoản đã gắn (chỉ có user_id). Ràng buộc orders_party_check
 *  cho phép một trong hai, nên thiếu vế user_id là mất hẳn doanh thu B2C.
 *  Cả hai vế đều đi index (idx_orders_customer / idx_orders_user). */
export function useCustomerAllOrders(customerId?: string, userId?: string | null) {
  return useQuery<Order[]>({
    queryKey: qk.orders.byCustomerUser(customerId, userId),
    queryFn: async () => {
      let q = ordersTable().select(ORDER_SELECT);
      // Chỉ dựng chuỗi .or() khi chắc chắn có customerId — enabled đã chặn
      // undefined lọt vào filter string.
      q = userId
        ? q.or(`customer_id.eq.${customerId},user_id.eq.${userId}`)
        : q.eq("customer_id", customerId);
      const { data, error } = await q.order("ordered_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Order[];
    },
    enabled: !!customerId,
  });
}

// Đơn hàng gắn với 1 banner quảng cáo (truy vết ngược từ chi tiết quảng cáo).
export function useAdvertisementOrders(advertisementId?: string) {
  return useQuery<Order[]>({
    queryKey: qk.orders.byAdvertisement(advertisementId),
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

/** Thông điệp tiếng Việt do trigger orders_sync_kind_and_commission phát ra.
 *  Trả về câu cụ thể để toast, hoặc null nếu không nhận ra (rơi về câu chung). */
const TRIGGER_MESSAGES = [
  "Đơn hoa hồng phải có nhà cung cấp",
  "Đơn hoa hồng phải có giá trị hợp đồng",
  "Đơn hoa hồng phải có loại và tỷ lệ hoa hồng",
  "Hoa hồng vượt quá giá trị hợp đồng",
  "Dịch vụ không tồn tại",
  "Không đổi loại dịch vụ khi đã có đơn hàng",
];

export function orderErrorMessage(err: unknown): string | null {
  const e = err as { message?: string; code?: string };
  const msg = e?.message ?? "";
  const hit = TRIGGER_MESSAGES.find((m) => msg.includes(m));
  if (hit) return hit;
  // Vượt trần NUMERIC — hiếm nhưng nếu xảy ra thì "Thao tác thất bại" vô nghĩa.
  if (e?.code === "22003") return "Số tiền vượt quá giới hạn cho phép";
  return null;
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
      qc.invalidateQueries({ queryKey: qk.orders.all });
      qc.invalidateQueries({ queryKey: ["order", data.id] });
      if (data.customer_id) {
        qc.invalidateQueries({ queryKey: qk.orders.byCustomer(data.customer_id) });
      }
      // Đơn hàng giờ là nguồn doanh thu duy nhất → báo cáo phải làm mới theo.
      qc.invalidateQueries({ queryKey: ["admin", "revenue-report"] });
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.orders.all });
      qc.invalidateQueries({ queryKey: ["admin", "revenue-report"] });
    },
  });
}
