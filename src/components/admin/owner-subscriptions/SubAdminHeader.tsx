import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

export type SubAdminSection = "subs" | "catalog" | "terms";

const TABS: { key: SubAdminSection; label: string; to: string }[] = [
  { key: "subs", label: "Trạm đăng ký", to: "/admin/goi-thue-bao/ap-dung" },
  { key: "catalog", label: "Danh mục gói", to: "/admin/goi-thue-bao/danh-muc" },
  { key: "terms", label: "Kỳ mua & chiết khấu", to: "/admin/goi-thue-bao/ky-mua" },
];

interface Props {
  section: SubAdminSection;
  title: string;
  description?: string;
  actions?: ReactNode;
}

/** Đầu trang chung của cụm Gói thuê bao: tiêu đề + 3 tab (Trạm đăng ký / Danh mục gói / Kỳ mua). */
export function SubAdminHeader({ section, title, description, actions }: Props) {
  const navigate = useNavigate();
  return (
    <div className="border-b bg-card">
      <div className="px-6 pt-5">
        <div className="mb-3.5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-xs font-medium text-muted-foreground">Gói thuê bao</div>
            <h1 className="text-xl font-semibold text-foreground">{title}</h1>
            {description && <p className="mt-0.5 max-w-3xl text-sm text-muted-foreground">{description}</p>}
          </div>
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </div>
        <div role="tablist" className="-mb-px flex gap-5 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={section === t.key}
              onClick={() => navigate(t.to)}
              className={cn(
                "shrink-0 whitespace-nowrap border-b-2 pb-2.5 text-sm font-medium transition-colors",
                section === t.key
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
