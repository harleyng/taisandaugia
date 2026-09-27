import { Fragment } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { OWNER_TARGETS_HREF } from "@/lib/ownerTargets";

interface TargetCrumbProps {
  /** Các chặng sau "Chỉ tiêu": có `to` là nút quay lại, không có là chữ thường. */
  trail?: { label: string; to?: string }[];
}

/** "‹ Chỉ tiêu / Đang thực hiện" — đầu trang chi tiết và trang form. */
export function TargetCrumb({ trail = [] }: TargetCrumbProps) {
  const navigate = useNavigate();
  const link = "flex min-w-0 items-center gap-1 font-semibold text-muted-foreground hover:text-foreground";
  return (
    <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-[13px] text-muted-foreground">
      <button type="button" className={link} onClick={() => navigate(OWNER_TARGETS_HREF)}>
        <ChevronLeft className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} aria-hidden="true" />
        Chỉ tiêu
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
