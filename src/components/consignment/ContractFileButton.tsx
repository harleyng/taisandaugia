import { useEffect, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { signContractFile } from "@/hooks/useConsignmentContract";
import { CONTRACT_BUCKET } from "@/lib/consignment/contractFiles";

interface ContractFileButtonProps {
  path: string;
  label: string;
  /** Mặc định bucket hợp đồng; giấy tờ sở hữu dùng 'asset-docs'. */
  bucket?: string;
  size?: "sm" | "default";
}

/**
 * Nút mở tệp trong bucket PRIVATE. Ký URL trước khi render (không ký trong
 * onClick): window.open sau một await bị trình duyệt chặn như popup.
 */
export function ContractFileButton({ path, label, bucket = CONTRACT_BUCKET, size = "sm" }: ContractFileButtonProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    setUrl(null);
    setFailed(false);
    signContractFile(path, bucket).then((u) => {
      if (!alive) return;
      setUrl(u);
      setFailed(!u);
    });
    return () => {
      alive = false;
    };
  }, [path, bucket]);

  return (
    <Button
      type="button"
      variant="outline"
      size={size}
      className="gap-2"
      disabled={!url}
      onClick={() => url && window.open(url, "_blank", "noopener")}
    >
      {url ? <Download className="h-4 w-4" /> : !failed && <Loader2 className="h-4 w-4 animate-spin" />}
      {failed ? "Không mở được tệp" : label}
    </Button>
  );
}
