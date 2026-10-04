import type { ReactNode } from "react";
import { PartnerScopeContext } from "./partnerScopeContext";

/** Bọc ô chọn đối tác riêng bằng phạm vi của hồ sơ (id Trạm, hoặc null = chủ cá nhân). */
export function PartnerScopeProvider({ workspaceId, children }: { workspaceId: string | null; children: ReactNode }) {
  return <PartnerScopeContext.Provider value={workspaceId}>{children}</PartnerScopeContext.Provider>;
}
