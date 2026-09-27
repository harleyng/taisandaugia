import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { signQuoteDoc } from "@/hooks/useOrgServiceRequests";

/** "↓ Tệp báo giá" — ký link tải lúc bấm (link ký có hạn, không ký sẵn cho mọi báo giá). */
export function QuoteDocLink({ path }: { path: string }) {
  const [busy, setBusy] = useState(false);

  const open = async () => {
    setBusy(true);
    try {
      const url = await signQuoteDoc(path);
      if (!url) throw new Error("no-url");
      window.open(url, "_blank", "noopener");
    } catch {
      toast.error("Không mở được tệp báo giá. Vui lòng thử lại.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={open}
      disabled={busy}
      className="inline-flex items-center gap-1 text-[13px] font-semibold text-primary hover:underline disabled:opacity-60"
    >
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
      Tệp báo giá
    </button>
  );
}
