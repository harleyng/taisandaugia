import { Fragment } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { OWNER_PLANS_HREF } from "@/lib/auctionPlan/routes";

interface PlanCrumbProps {
  /** Các chặng sau "Kế hoạch đấu giá": có `to` là nút quay lại, không có là chữ thường. */
  trail?: { label: string; to?: string }[];
}

/** "‹ Kế hoạch đấu giá / Kế hoạch năm 2027" — đầu trang chi tiết. */
export function PlanCrumb({ trail = [] }: PlanCrumbProps) {
  const navigate = useNavigate();
  const link = "flex min-w-0 items-center gap-1 font-semibold text-muted-foreground hover:text-foreground";
  return (
    <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-[13px] text-muted-foreground">
      <button type="button" className={link} onClick={() => navigate(OWNER_PLANS_HREF)}>
        <ChevronLeft className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} aria-hidden="true" />
        Kế hoạch đấu giá
      </button>
      {trail.map((t) => (
        <Fragment key={t.label}>
          <span aria-hidden="true">/</span>
          {t.to ? (
            <button type="button" className={link} onClick={() => navigate(t.to!)}>
              <span className="truncate">{t.label}</span>
            </button>
          ) : (
            <span className="truncate" aria-current="page">
              {t.label}
            </span>
          )}
        </Fragment>
      ))}
    </nav>
  );
}
