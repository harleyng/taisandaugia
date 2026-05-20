import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { ArrowRight, Shield, UserCheck, FileText, Info } from "lucide-react";
import { useState } from "react";
import { AuctionCompany } from "@/lib/mockAuctionCompanies";

export type TitleType = "legal_rep" | "authorized_person";

interface Step2SelectTitleProps {
  company: AuctionCompany;
  onNext: (title: TitleType) => void;
  onBack: () => void;
}

export const Step2SelectTitle = ({ company, onNext, onBack }: Step2SelectTitleProps) => {
  const [title, setTitle] = useState<TitleType | "">("");

  return (
    <div className="space-y-5">
      <div>
        <h3 className="font-semibold text-base text-foreground mb-1">Chọn chức danh</h3>
        <p className="text-sm text-muted-foreground">
          Bạn đại diện cho <span className="font-medium text-foreground">{company.name}</span> với tư cách nào?
        </p>
      </div>

      <RadioGroup value={title} onValueChange={(v) => setTitle(v as TitleType)} className="space-y-3">
        {/* Legal rep */}
        <div
          className={`relative flex items-start gap-4 rounded-xl border-2 p-4 cursor-pointer transition-all ${
            title === "legal_rep" ? "border-primary bg-primary/5" : "border-border hover:border-primary/40 hover:bg-muted/30"
          }`}
          onClick={() => setTitle("legal_rep")}
        >
          <RadioGroupItem value="legal_rep" id="legal_rep" className="mt-0.5" />
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center">
                <Shield className="h-3.5 w-3.5 text-blue-600" />
              </div>
              <Label htmlFor="legal_rep" className="font-semibold text-sm cursor-pointer">
                Người đại diện theo pháp luật
              </Label>
            </div>
            <p className="text-xs text-muted-foreground">
              Giám đốc, Tổng giám đốc hoặc người đứng đầu doanh nghiệp theo quy định trong Giấy đăng ký kinh doanh.
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="inline-flex items-center gap-1 text-[11px] bg-muted px-2 py-0.5 rounded-full text-muted-foreground">
                <FileText className="h-3 w-3" />
                Bản sao công chứng ĐKDN
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] bg-muted px-2 py-0.5 rounded-full text-muted-foreground">
                <FileText className="h-3 w-3" />
                Giấy phép hoạt động đấu giá
              </span>
            </div>
          </div>
        </div>

        {/* Authorized person */}
        <div
          className={`relative flex items-start gap-4 rounded-xl border-2 p-4 cursor-pointer transition-all ${
            title === "authorized_person" ? "border-primary bg-primary/5" : "border-border hover:border-primary/40 hover:bg-muted/30"
          }`}
          onClick={() => setTitle("authorized_person")}
        >
          <RadioGroupItem value="authorized_person" id="authorized_person" className="mt-0.5" />
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center">
                <UserCheck className="h-3.5 w-3.5 text-amber-600" />
              </div>
              <Label htmlFor="authorized_person" className="font-semibold text-sm cursor-pointer">
                Người được ủy quyền
              </Label>
            </div>
            <p className="text-xs text-muted-foreground">
              Người được người đại diện pháp luật ủy quyền bằng văn bản hợp lệ để thực hiện các thủ tục đăng ký.
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="inline-flex items-center gap-1 text-[11px] bg-muted px-2 py-0.5 rounded-full text-muted-foreground">
                <FileText className="h-3 w-3" />
                Bản sao công chứng ĐKDN
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] bg-muted px-2 py-0.5 rounded-full text-muted-foreground">
                <FileText className="h-3 w-3" />
                Giấy phép hoạt động đấu giá
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] bg-amber-50 border border-amber-200 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                <FileText className="h-3 w-3" />
                + Giấy ủy quyền
              </span>
            </div>
          </div>
        </div>
      </RadioGroup>

      {title === "authorized_person" && (
        <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
          <Info className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-amber-600" />
          <span>
            Bạn sẽ cần upload thêm <strong>Giấy ủy quyền</strong> (có công chứng) ở bước tiếp theo. Giấy ủy quyền phải còn hiệu lực và ghi rõ phạm vi ủy quyền đăng ký tài khoản.
          </span>
        </div>
      )}

      <div className="flex gap-3">
        <Button variant="outline" onClick={onBack} className="flex-1">
          Quay lại
        </Button>
        <Button onClick={() => onNext(title as TitleType)} disabled={!title} className="flex-1">
          Tiếp tục
          <ArrowRight className="ml-1.5 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};
