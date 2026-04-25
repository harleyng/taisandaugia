import { useNavigate } from "react-router-dom";
import { Banknote, Building2, Car, Landmark } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Tab = {
  slug: string;
  label: string;
  icon: typeof Building2;
  enabled: boolean;
};

const TABS: Tab[] = [
  { slug: "bds", label: "Bất động sản", icon: Building2, enabled: true },
  { slug: "oto", label: "Ô tô", icon: Car, enabled: false },
  { slug: "tai-san-cong", label: "Tài sản công", icon: Landmark, enabled: false },
  { slug: "npl", label: "Nợ xấu (NPL)", icon: Banknote, enabled: false },
];

interface CategoryFilterTabsProps {
  currentSlug: string;
}

export const CategoryFilterTabs = ({ currentSlug }: CategoryFilterTabsProps) => {
  const navigate = useNavigate();

  return (
    <div className="border-b border-border bg-muted/30">
      <div className="container py-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
          Chọn danh mục báo cáo
        </p>
        <div className="flex flex-wrap gap-2">
          {TABS.map((t) => {
            const Icon = t.icon;
            const isActive = t.slug === currentSlug;

            if (!t.enabled) {
              return (
                <button
                  key={t.slug}
                  type="button"
                  disabled
                  title="Báo cáo chuyên sâu cho danh mục này sắp ra mắt"
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full text-sm border border-border bg-background opacity-60 cursor-not-allowed"
                >
                  <Icon className="h-4 w-4" />
                  <span>{t.label}</span>
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 ml-0.5">
                    Sắp ra mắt
                  </Badge>
                </button>
              );
            }

            return (
              <button
                key={t.slug}
                type="button"
                onClick={() => navigate(`/report/${t.slug}`)}
                className={cn(
                  "inline-flex items-center gap-2 px-3.5 py-2 rounded-full text-sm border transition-all",
                  isActive
                    ? "border-primary bg-primary text-primary-foreground shadow-sm font-medium"
                    : "border-border bg-background text-foreground hover:border-primary/40 hover:bg-primary/5",
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
