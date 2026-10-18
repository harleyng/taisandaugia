import { useNavigate } from "react-router-dom";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BTN } from "@/components/auction-sessions/detail/buttonStyles";

interface Props {
  name: string | null | undefined;
  phone: string | null | undefined;
  address: string | null | undefined;
  logoUrl?: string | null;
  sessionId: string;
}

/** Thẻ tổ chức đấu giá ở cột phải: điện thoại, địa chỉ, hỏi về phiên. */
export function OrgContactCard({ name, phone, address, logoUrl, sessionId }: Props) {
  const navigate = useNavigate();
  const label = name || "Tổ chức đấu giá";
  return (
    <section className="flex flex-col gap-3 rounded-2xl bg-card p-4">
      <div className="flex items-center gap-3">
        {logoUrl ? (
          <img src={logoUrl} alt={label} className="h-12 w-12 shrink-0 rounded-xl object-cover" />
        ) : (
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-muted font-semibold text-muted-foreground">
            {label.replace(/^Công ty\s+/i, "").charAt(0)}
          </span>
        )}
        <div className="min-w-0">
          <span className="text-xs text-muted-foreground">Tổ chức đấu giá</span>
          <div className="font-semibold text-foreground">{label}</div>
        </div>
      </div>
      {(phone || address) && (
        <dl className="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-4 gap-y-2 rounded-xl bg-muted p-3 text-[13px]">
          {phone && (
            <>
              <dt className="text-muted-foreground">Điện thoại</dt>
              <dd>
                <a href={`tel:${phone.replace(/\s/g, "")}`} className="text-primary hover:underline">
                  {phone}
                </a>
              </dd>
            </>
          )}
          {address && (
            <>
              <dt className="text-muted-foreground">Địa chỉ</dt>
              <dd className="text-foreground">{address}</dd>
            </>
          )}
        </dl>
      )}
      <Button className={`${BTN.soft} gap-1.5`} onClick={() => navigate(`/sessions/${sessionId}/hoi-dap`)}>
        <MessageCircle className="h-4 w-4" />
        Hỏi về phiên
      </Button>
    </section>
  );
}
