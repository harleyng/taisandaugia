import { Sparkles, X } from "lucide-react";
import { useState } from "react";

interface Props {
  fields: string[];
}

export const PreFillBanner = ({ fields }: Props) => {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed || fields.length === 0) return null;

  return (
    <div className="flex items-start gap-3 rounded-xl bg-primary/8 border border-primary/20 px-4 py-3 text-sm">
      <Sparkles className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <span className="font-medium text-foreground">Điền sẵn từ hồ sơ</span>
        <span className="text-muted-foreground ml-1">
          {fields.join(", ")} đã được lấy từ hồ sơ cá nhân của bạn.
        </span>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="text-muted-foreground hover:text-foreground flex-shrink-0"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};
