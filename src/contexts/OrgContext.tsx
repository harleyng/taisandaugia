import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useMyOrganizations } from "@/hooks/useMyOrganizations";
import type { MyOrg } from "@/types/orgRbac";

const STORAGE_KEY = "portal:orgId";

interface OrgContextValue {
  orgs: MyOrg[];
  currentOrg: MyOrg | null;
  currentOrgId: string | null;
  setCurrentOrg: (id: string) => void;
  loading: boolean;
}

const OrgContext = createContext<OrgContextValue | undefined>(undefined);

/**
 * Tổ chức đang được chọn trong portal. Mount BÊN TRONG PortalLayout (không phải
 * App.tsx) để không đụng vào thứ tự provider hiện có.
 *
 * Lựa chọn lưu ở localStorage nhưng LUÔN được kiểm chứng lại với danh sách thật:
 * user có thể bị gỡ khỏi tổ chức giữa hai phiên, id cũ khi đó phải rơi về org đầu.
 */
export function OrgProvider({ children }: { children: ReactNode }) {
  const { data: orgs, isLoading } = useMyOrganizations();
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  });

  const list = useMemo(() => orgs ?? [], [orgs]);

  // Id đã lưu không còn hợp lệ (bị gỡ khỏi tổ chức, tổ chức bị xóa) → org đầu tiên.
  const currentOrg = useMemo(() => {
    if (list.length === 0) return null;
    return list.find((o) => o.id === selectedId) ?? list[0];
  }, [list, selectedId]);

  // Đồng bộ ngược lại localStorage khi lựa chọn được suy ra khác id đã lưu.
  useEffect(() => {
    if (!currentOrg || currentOrg.id === selectedId) return;
    setSelectedId(currentOrg.id);
    try {
      localStorage.setItem(STORAGE_KEY, currentOrg.id);
    } catch {
      /* localStorage bị chặn — bỏ qua, state trong bộ nhớ vẫn chạy */
    }
  }, [currentOrg, selectedId]);

  const value = useMemo<OrgContextValue>(
    () => ({
      orgs: list,
      currentOrg,
      currentOrgId: currentOrg?.id ?? null,
      setCurrentOrg: (id: string) => {
        setSelectedId(id);
        try {
          localStorage.setItem(STORAGE_KEY, id);
        } catch {
          /* bỏ qua */
        }
      },
      loading: isLoading,
    }),
    [list, currentOrg, isLoading],
  );

  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>;
}

export function useOrg(): OrgContextValue {
  const ctx = useContext(OrgContext);
  if (!ctx) throw new Error("useOrg phải được dùng bên trong <OrgProvider>");
  return ctx;
}
