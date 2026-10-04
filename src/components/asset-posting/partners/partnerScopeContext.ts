import { createContext, useContext } from "react";

/**
 * Phạm vi danh bạ đối tác riêng của hồ sơ đang mở: id Trạm, hoặc null = chủ cá nhân.
 * undefined = chưa bọc PartnerScopeProvider.
 */
export const PartnerScopeContext = createContext<string | null | undefined>(undefined);

export function usePartnerScope(): string | null {
  const scope = useContext(PartnerScopeContext);
  if (scope === undefined) throw new Error("usePartnerScope cần PartnerScopeProvider");
  return scope;
}
