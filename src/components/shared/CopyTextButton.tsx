import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button, type ButtonProps } from "@/components/ui/button";

interface Props extends Omit<ButtonProps, "onClick" | "children"> {
  text: string;
  label?: string;
  copiedLabel?: string;
}

/** Nút sao chép văn bản thuần (vd. câu trả lời dán sang Zalo). */
export function CopyTextButton({ text, label = "Sao chép", copiedLabel = "Đã sao chép", ...rest }: Props) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Trình duyệt không cho sao chép — hãy bôi đen và sao chép thủ công.");
    }
  };

  return (
    <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={copy} {...rest}>
      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      {copied ? copiedLabel : label}
    </Button>
  );
}
