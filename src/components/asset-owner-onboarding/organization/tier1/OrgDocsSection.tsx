import { useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { FileText, Upload, CheckCircle2, Send } from "lucide-react";
import { cn } from "@/lib/utils";

interface DocRowProps {
  label: string;
  hint: string;
  required: boolean;
  uploaded: boolean;
  onPick: (f: File) => void;
}

const DocRow = ({ label, hint, required, uploaded, onPick }: DocRowProps) => {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div
      className={cn(
        "flex items-center gap-3 p-3 rounded-xl border transition-colors",
        uploaded ? "border-green-300 bg-green-50" : "border-border"
      )}
    >
      <input
        ref={ref}
        type="file"
        accept="application/pdf,image/jpeg,image/png"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onPick(f); e.target.value = ""; }}
      />
      <div className={cn("w-9 h-9 rounded-lg flex-shrink-0 flex items-center justify-center", uploaded ? "bg-green-100" : "bg-muted")}>
        {uploaded
          ? <CheckCircle2 className="h-4 w-4 text-green-600" />
          : <FileText className="h-4 w-4 text-muted-foreground" />
        }
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </p>
        <p className="text-[11px] text-muted-foreground">{hint}</p>
      </div>
      <button
        type="button"
        onClick={() => ref.current?.click()}
        className={cn(
          "text-xs px-2.5 py-1 rounded-lg font-medium transition-colors flex-shrink-0",
          uploaded
            ? "text-primary hover:bg-primary/10"
            : "bg-primary/10 text-primary hover:bg-primary/20"
        )}
      >
        {uploaded ? "Thay" : <span className="flex items-center gap-1"><Upload className="h-3 w-3" />Tải lên</span>}
      </button>
    </div>
  );
};

interface Props {
  establishmentUploaded: boolean;
  authorizationUploaded: boolean;
  termsAccepted: boolean;
  onAcceptTerms: (v: boolean) => void;
  onUpload: (slot: "establishment_doc" | "authorization_doc", file: File) => Promise<void>;
  onSubmit: () => void;
  disabled: boolean;
  isSubmitting: boolean;
}

export const OrgDocsSection = ({
  establishmentUploaded, authorizationUploaded,
  termsAccepted, onAcceptTerms,
  onUpload, onSubmit, disabled, isSubmitting,
}: Props) => (
  <Card className="rounded-2xl p-5 space-y-4">
    <h3 className="font-semibold text-foreground flex items-center gap-2">
      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">D</span>
      Tài liệu pháp lý tổ chức
    </h3>

    <div className="space-y-2">
      <DocRow
        label="Giấy phép / Quyết định thành lập"
        hint="Scan bản công chứng. PDF/JPG/PNG, tối đa 10 MB"
        required
        uploaded={establishmentUploaded}
        onPick={(f) => onUpload("establishment_doc", f)}
      />
      <DocRow
        label="Giấy ủy quyền / Quyết định bổ nhiệm"
        hint="Nếu không phải đại diện pháp luật. PDF/JPG/PNG"
        required={false}
        uploaded={authorizationUploaded}
        onPick={(f) => onUpload("authorization_doc", f)}
      />
    </div>

    <div className="flex items-start gap-3 pt-2">
      <Checkbox
        id="org_terms"
        checked={termsAccepted}
        onCheckedChange={(v) => onAcceptTerms(!!v)}
      />
      <Label htmlFor="org_terms" className="font-normal text-sm cursor-pointer leading-relaxed">
        Tôi xác nhận thông tin tổ chức là chính xác và được ủy quyền thực hiện KYC này. Chấp nhận{" "}
        <a href="/dieu-khoan-su-dung" target="_blank" className="text-primary hover:underline">
          Điều khoản
        </a>.
      </Label>
    </div>

    <Button
      onClick={onSubmit}
      disabled={disabled || !termsAccepted || isSubmitting}
      className="w-full gap-2"
    >
      <Send className="h-4 w-4" />
      {isSubmitting ? "Đang gửi..." : "Nộp hồ sơ tổ chức"}
    </Button>
  </Card>
);
