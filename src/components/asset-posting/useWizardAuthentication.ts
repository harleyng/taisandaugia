import { useMemo } from "react";
import { useAuthenticationRules, usePostingAuthenticationOrders } from "@/hooks/useAuthenticationOrders";
import { requiredReasons } from "@/lib/authentication/requirement";
import type { AuthenticationContext, WizardValues } from "./wizardSchema";

/**
 * Giám định trong wizard (BR-GD-03): lý do bắt buộc tính từ GIÁ TRỊ FORM đang nhập (giá,
 * nhóm) + chính sách + cờ người bán/lô, và đã có chứng thư "xác thực" chưa. Giữ ở cấp
 * wizard vì cả bước 4 (khối Giám định) lẫn requirements() (nút Hoàn tất) cùng cần.
 */
export function useWizardAuthentication(f: WizardValues, postingId: string | null) {
  const { data: rules } = useAuthenticationRules(postingId);
  const { data: orders = [] } = usePostingAuthenticationOrders(postingId);

  const startingPrice = f.pricingMode === "self" && f.startingPrice ? Number(f.startingPrice) : null;
  const reasons = useMemo(
    () =>
      requiredReasons({
        parentSlug: f.parentSlug,
        startingPrice,
        policy: rules?.policy ?? null,
        sellerRestricted: !!rules?.sellerRestricted,
        lotFlagged: !!rules?.lotFlagged,
      }),
    [f.parentSlug, startingPrice, rules],
  );
  const authentic = orders.some((o) => o.status === "completed" && o.verdict === "authentic");

  const ctx: AuthenticationContext = { required: reasons.length > 0, authentic };
  return { reasons, lotReason: rules?.lotReason ?? null, ctx };
}
