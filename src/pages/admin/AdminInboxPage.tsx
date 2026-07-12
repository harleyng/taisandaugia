import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { MessageSquare, Handshake, type LucideIcon } from "lucide-react";
import ContactSubmissionsPanel from "@/components/admin/inbox/ContactSubmissionsPanel";
import PartnershipRegistrationsPanel from "@/components/admin/inbox/PartnershipRegistrationsPanel";

type Loai = "lien-he" | "hop-tac";

export default function AdminInboxPage() {
  const [params, setParams] = useSearchParams();
  const [loai, setLoai] = useState<Loai>(
    params.get("loai") === "hop-tac" ? "hop-tac" : "lien-he",
  );
  const [contactPending, setContactPending] = useState(0);
  const [partnershipPending, setPartnershipPending] = useState(0);

  useEffect(() => {
    document.title = "Liên hệ & Hợp tác — Tài Sản Đấu Giá";
  }, []);

  const selectLoai = (next: Loai) => {
    setLoai(next);
    const p = new URLSearchParams(params);
    if (next === "lien-he") p.delete("loai");
    else p.set("loai", next);
    setParams(p, { replace: true });
  };

  const LOAI: { key: Loai; label: string; icon: LucideIcon; pending: number }[] = [
    { key: "lien-he", label: "Liên hệ", icon: MessageSquare, pending: contactPending },
    { key: "hop-tac", label: "Hợp tác", icon: Handshake, pending: partnershipPending },
  ];

  return (
    <div className="px-6 py-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-foreground">Liên hệ &amp; Hợp tác</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Tin nhắn liên hệ và đăng ký hợp tác gửi từ website
        </p>
      </div>

      {/* Loại selector */}
      <div className="flex gap-2 border-b border-border">
        {LOAI.map(({ key, label, icon: Icon, pending }) => (
          <button
            key={key}
            onClick={() => selectLoai(key)}
            className={[
              "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px",
              loai === key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground",
            ].join(" ")}
          >
            <Icon className="h-4 w-4" />
            {label}
            {pending > 0 && (
              <span className="text-[10px] rounded-full bg-amber-100 text-amber-800 px-1.5 py-0.5 font-semibold">
                {pending}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Panels — both mounted so the selector badges stay live; inactive is hidden */}
      <div className={loai === "lien-he" ? undefined : "hidden"}>
        <ContactSubmissionsPanel onPendingChange={setContactPending} />
      </div>
      <div className={loai === "hop-tac" ? undefined : "hidden"}>
        <PartnershipRegistrationsPanel onPendingChange={setPartnershipPending} />
      </div>
    </div>
  );
}
