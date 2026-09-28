import { useAuth } from "@/contexts/AuthContext";
import { useServiceCatalog } from "@/hooks/useServiceCatalog";
import { useBiddingContract } from "@/hooks/useBiddingContracts";
import { useVrTourOrder } from "@/hooks/useVrTourOrders";
import { useAuthenticationOrder } from "@/hooks/useAuthenticationOrders";
import { useLegalConsultation } from "@/hooks/useLegalConsultations";
import { ownerLegalConsultPath } from "@/lib/legalConsult/paths";
import { useAuctionConsultation } from "@/hooks/useAuctionConsultations";
import { currentServiceContract, useOrderServiceContracts } from "@/hooks/useServiceContracts";
import type { ServiceKindKey } from "@/lib/serviceRequests/kinds";
import { ownerAuctionConsultPath } from "@/lib/auctionConsult/paths";
import { isQuoteExpired } from "@/lib/vrTour/status";
import { ownerPostingPath } from "@/lib/vrTour/paths";
import { useOwnerSubscriptionQuote } from "@/hooks/useOwnerSubscription";
import { useOwnerSubPlanQuote } from "@/hooks/useOwnerSubscriptionPlans";
import { OWNER_SUBSCRIPTION_PATH } from "@/lib/ownerSubscription/paths";
import { formatSubDate } from "@/lib/ownerSubscription/status";

/** Thứ đang được thanh toán trên trang VNPay mô phỏng. */
export interface CheckoutItem {
  /** Mã hiển thị / nhúng vào QR. */
  ref: string;
  label: string;
  priceVnd: number;
  /** Tham số nhận diện gửi sang /payment-result (package=… hoặc contract=…). */
  resultParams: Record<string, string>;
}

interface CheckoutState {
  loading: boolean;
  item: CheckoutItem | null;
  /** Nơi quay về khi không có gì hợp lệ để thanh toán. */
  fallbackPath: string;
}

/**
 * Ba loại hàng qua cùng một trang thanh toán:
 *   • ?package=<variant_key> — gói credit, giá lấy từ catalog (luồng cũ, giữ nguyên).
 *   • ?contract=<id>        — hồ sơ tham gia; giá là BẢN CHỤP trên hồ sơ, không
 *     đọc lại giá phiên (tổ chức có thể vừa đổi giá trong lúc người mua giữ chỗ).
 *   • ?vr_order=<id>        — đơn VR tour; giá là báo giá trên đơn. Số tiền được gửi
 *     kèm sang /payment-result để server từ chối nếu admin vừa báo giá lại.
 *   • ?gd_order=<id>        — đơn giám định; cùng quy tắc với VR tour.
 *   • ?tvpl_order=<id>      — lần tư vấn pháp lý; cùng quy tắc với VR tour.
 *   • ?tvdg_order=<id>      — yêu cầu tư vấn đấu giá; cùng quy tắc với VR tour.
 *   • ?sub=<id>             — gói thuê bao tổ chức chủ tài sản; chỉ Trưởng đơn vị trả được.
 *   • ?sub_plan=<id>&months=<n>&ws=<id> — gói trong danh mục gói dịch vụ; giá do server
 *     báo (owner_sub_plan_quote), số tiền gửi kèm để server từ chối nếu giá vừa đổi.
 */
export function useCheckoutItem(params: URLSearchParams): CheckoutState {
  const packageKey = params.get("package") || "";
  const contractId = params.get("contract") || "";
  const catalog = useServiceCatalog();
  const contract = useBiddingContract(contractId || null);
  const vrOrderId = params.get("vr_order") || "";
  const vrOrder = useVrTourOrder(vrOrderId || null);
  const gdOrderId = params.get("gd_order") || "";
  const gdOrder = useAuthenticationOrder(gdOrderId || null);
  const tvplId = params.get("tvpl_order") || "";
  const tvpl = useLegalConsultation(tvplId || null);
  const tvdgId = params.get("tvdg_order") || "";
  const tvdg = useAuctionConsultation(tvdgId || null);
  const subId = params.get("sub") || "";
  const subQuote = useOwnerSubscriptionQuote(subId || null);
  const subPlanId = params.get("sub_plan") || "";
  const subPlanMonths = Number(params.get("months")) || null;
  const subPlanWs = params.get("ws") || "";
  const planQuote = useOwnerSubPlanQuote(subPlanWs || null, subPlanId || null, subPlanMonths);
  // Đơn dịch vụ gắn hồ sơ số hoá: từ Phase 4 đồng nghiệp cùng không gian ĐỌC được
  // đơn (RLS theo hồ sơ), nhưng chỉ NGƯỜI GỬI yêu cầu thanh toán — _settle_* kiểm
  // user_id, trả trước rồi mới bị từ chối là mất tiền.
  const { userId } = useAuth();
  // Hợp đồng cung ứng dịch vụ (HDCU): phải ĐỒNG Ý báo giá hiện hành trước khi trả —
  // chưa đồng ý (mở link thẳng / báo giá vừa đổi) ⇒ không có gì để trả, quay về thẻ đơn.
  const scKind: ServiceKindKey | null = tvdgId
    ? "tu-van-dau-gia"
    : tvplId
      ? "tu-van-phap-ly"
      : gdOrderId
        ? "giam-dinh"
        : vrOrderId
          ? "vr-tour"
          : null;
  const serviceContracts = useOrderServiceContracts(scKind, tvdgId || tvplId || gdOrderId || vrOrderId || null);
  const notAccepted = (o: { quoted_at: string | null; quoted_price: number | string | null }) =>
    !currentServiceContract(serviceContracts.data, {
      quoted_at: o.quoted_at,
      quoted_price: o.quoted_price == null ? null : Number(o.quoted_price),
    });

  if (subPlanId) {
    const q = planQuote.data;
    const back = params.get("return") || OWNER_SUBSCRIPTION_PATH;
    if (planQuote.isLoading) return { loading: true, item: null, fallbackPath: back };
    // Không phải Trưởng đơn vị / gói ngừng bán / đang có đổi gói chờ ⇒ không có gì để trả.
    if (!q || !q.can_pay) return { loading: false, item: null, fallbackPath: back };
    const when = q.effect === "next_term" ? ", áp dụng từ kỳ sau" : "";
    return {
      loading: false,
      fallbackPath: back,
      item: {
        ref: q.plan_name,
        label: `Gói dịch vụ ${q.plan_name} · ${q.workspace_name} · ${q.months} tháng (${formatSubDate(q.starts_on)} – ${formatSubDate(q.ends_on)}${when})`,
        priceVnd: Number(q.amount_vnd),
        resultParams: { sub_plan: q.plan_id, months: String(q.months), ws: q.workspace_id, amount: String(q.amount_vnd) },
      },
    };
  }

  if (subId) {
    const q = subQuote.data;
    const back = params.get("return") || OWNER_SUBSCRIPTION_PATH;
    if (subQuote.isLoading) return { loading: true, item: null, fallbackPath: back };
    // Không phải Trưởng đơn vị / gói nháp, huỷ / giá 0 ⇒ không có gì để trả.
    if (!q || !q.can_pay) return { loading: false, item: null, fallbackPath: back };
    return {
      loading: false,
      fallbackPath: back,
      item: {
        ref: q.code,
        label: `${q.plan_name} ${q.code} · ${q.workspace_name} · ${q.term_months} tháng (${formatSubDate(q.next_starts_on)} – ${formatSubDate(q.next_ends_on)})`,
        priceVnd: Number(q.price_vnd),
        resultParams: { sub: q.id, amount: String(q.price_vnd) },
      },
    };
  }

  if (tvdgId) {
    const o = tvdg.data;
    const back = params.get("return") || (o ? ownerAuctionConsultPath(o.asset_posting_id) : "/chu-tai-san/dang-tai-san");
    if (tvdg.isLoading || serviceContracts.isLoading) return { loading: true, item: null, fallbackPath: back };
    if (!o || o.status !== "quoted" || o.quoted_price == null || isQuoteExpired(o) || o.user_id !== userId || notAccepted(o)) {
      return { loading: false, item: null, fallbackPath: back };
    }
    return {
      loading: false,
      fallbackPath: back,
      item: {
        ref: o.code,
        label: `Tư vấn đấu giá ${o.code} · ${o.package_name} · ${o.partner_name ?? ""}`,
        priceVnd: Number(o.quoted_price),
        resultParams: { tvdg_order: o.id, amount: String(o.quoted_price) },
      },
    };
  }

  if (tvplId) {
    const o = tvpl.data;
    const back = params.get("return") || (o ? ownerLegalConsultPath(o.asset_posting_id) : "/chu-tai-san/dang-tai-san");
    if (tvpl.isLoading || serviceContracts.isLoading) return { loading: true, item: null, fallbackPath: back };
    if (!o || o.status !== "quoted" || o.quoted_price == null || isQuoteExpired(o) || o.user_id !== userId || notAccepted(o)) {
      return { loading: false, item: null, fallbackPath: back };
    }
    return {
      loading: false,
      fallbackPath: back,
      item: {
        ref: o.code,
        label: `Tư vấn pháp lý ${o.code} · ${o.package_name} · ${o.partner_name ?? ""}`,
        priceVnd: Number(o.quoted_price),
        resultParams: { tvpl_order: o.id, amount: String(o.quoted_price) },
      },
    };
  }

  if (gdOrderId) {
    const o = gdOrder.data;
    const back = params.get("return") || (o ? ownerPostingPath(o.asset_posting_id) : "/chu-tai-san/dang-tai-san");
    if (gdOrder.isLoading || serviceContracts.isLoading) return { loading: true, item: null, fallbackPath: back };
    if (!o || o.status !== "quoted" || o.quoted_price == null || isQuoteExpired(o) || o.user_id !== userId || notAccepted(o)) {
      return { loading: false, item: null, fallbackPath: back };
    }
    return {
      loading: false,
      fallbackPath: back,
      item: {
        ref: o.code,
        label: `Giám định ${o.code} · ${o.package_name} · ${o.partner_name}`,
        priceVnd: Number(o.quoted_price),
        resultParams: { gd_order: o.id, amount: String(o.quoted_price) },
      },
    };
  }

  if (vrOrderId) {
    const o = vrOrder.data;
    const back = params.get("return") || (o ? ownerPostingPath(o.asset_posting_id) : "/chu-tai-san/dang-tai-san");
    if (vrOrder.isLoading || serviceContracts.isLoading) return { loading: true, item: null, fallbackPath: back };
    // Chưa báo giá / đã trả / hết hạn / không phải của mình (RLS trả null) ⇒ không có gì để trả.
    if (!o || o.status !== "quoted" || o.quoted_price == null || isQuoteExpired(o) || o.user_id !== userId || notAccepted(o)) {
      return { loading: false, item: null, fallbackPath: back };
    }
    return {
      loading: false,
      fallbackPath: back,
      item: {
        ref: o.code,
        label: `VR tour ${o.code} · ${o.package_name} · ${o.partner_name}`,
        priceVnd: Number(o.quoted_price),
        resultParams: { vr_order: o.id, amount: String(o.quoted_price) },
      },
    };
  }

  if (contractId) {
    const c = contract.data;
    const sessionPath = c?.session_id ? `/sessions/${c.session_id}` : "/sessions";
    if (contract.isLoading) return { loading: true, item: null, fallbackPath: sessionPath };
    // Đã trả / đã huỷ / không phải của mình (RLS trả null) ⇒ không có gì để trả tiền.
    if (!c || c.status !== "pending_payment") return { loading: false, item: null, fallbackPath: sessionPath };
    const sessionCode = c.auction_sessions?.code;
    return {
      loading: false,
      fallbackPath: sessionPath,
      item: {
        ref: c.code,
        label: `Hồ sơ tham gia ${c.code}${sessionCode ? ` · phiên ${sessionCode}` : ""}`,
        priceVnd: Number(c.fee_amount),
        resultParams: { contract: c.id },
      },
    };
  }

  const fallbackPath = "/profile?tab=credits";
  if (catalog.isLoading) return { loading: true, item: null, fallbackPath };
  const pkg = catalog.variant(packageKey);
  if (!pkg) return { loading: false, item: null, fallbackPath };
  return {
    loading: false,
    fallbackPath,
    item: {
      ref: pkg.variant_key,
      label: `Gói ${pkg.name} — ${pkg.credits ?? 0} credit`,
      priceVnd: Number(pkg.price ?? 0),
      resultParams: { package: pkg.variant_key },
    },
  };
}
