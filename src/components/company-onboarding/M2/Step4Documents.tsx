import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Upload, CheckCircle2, FileText, Save, Info } from "lucide-react";
import { toast } from "sonner";
import { TitleType } from "./Step2SelectTitle";

interface Step4DocumentsProps {
  title: TitleType;
  onNext: () => void;
  onBack: () => void;
}

interface DocUploadState {
  name: string;
  description: string;
  required: boolean;
  uploaded: boolean;
}

const DocUploadRow = ({
  doc,
  onUpload,
}: {
  doc: DocUploadState & { key: string };
  onUpload: (key: string) => void;
}) => (
  <div
    className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
      doc.uploaded ? "border-green-300 bg-green-50" : "border-border bg-card"
    }`}
  >
    <div
      className={`w-10 h-10 rounded-lg flex-shrink-0 flex items-center justify-center ${
        doc.uploaded ? "bg-green-100" : "bg-muted"
      }`}
    >
      {doc.uploaded ? (
        <CheckCircle2 className="h-5 w-5 text-green-600" />
      ) : (
        <FileText className="h-5 w-5 text-muted-foreground" />
      )}
    </div>
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-1.5 flex-wrap">
        <p className="text-sm font-medium text-foreground leading-tight">{doc.name}</p>
        {doc.required && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-red-200 text-red-600 bg-red-50">
            Bắt buộc
          </Badge>
        )}
      </div>
      <p className="text-xs text-muted-foreground mt-0.5">{doc.description}</p>
    </div>
    <button
      onClick={() => onUpload(doc.key)}
      className={`flex-shrink-0 flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-all ${
        doc.uploaded
          ? "text-green-700 bg-green-100 hover:bg-green-200"
          : "text-primary bg-primary/10 hover:bg-primary/20"
      }`}
    >
      {doc.uploaded ? (
        <>
          <CheckCircle2 className="h-3.5 w-3.5" />
          Đã tải
        </>
      ) : (
        <>
          <Upload className="h-3.5 w-3.5" />
          Tải lên
        </>
      )}
    </button>
  </div>
);

export const Step4Documents = ({ title, onNext, onBack }: Step4DocumentsProps) => {
  const [docs, setDocs] = useState<Record<string, DocUploadState>>({
    dkdn: {
      name: "Bản sao công chứng ĐKDN",
      description: "Giấy chứng nhận đăng ký doanh nghiệp hoặc Giấy phép kinh doanh (bản sao có công chứng, còn hiệu lực)",
      required: true,
      uploaded: false,
    },
    auction_license: {
      name: "Giấy phép hoạt động đấu giá tài sản",
      description: "Do Bộ Tư pháp cấp, còn hiệu lực",
      required: true,
      uploaded: false,
    },
    authorization: {
      name: "Giấy ủy quyền",
      description: "Văn bản ủy quyền có công chứng từ người đại diện pháp luật, ghi rõ phạm vi và thời hạn ủy quyền",
      required: title === "authorized_person",
      uploaded: false,
    },
  });

  const handleUpload = (key: string) => {
    setTimeout(() => {
      setDocs((prev) => ({ ...prev, [key]: { ...prev[key], uploaded: true } }));
      toast.success("Tải lên thành công (demo)");
    }, 600);
  };

  const handleSaveDraft = () => {
    toast.success("Đã lưu nháp hồ sơ", {
      description: "Bạn có thể tiếp tục hoàn thiện sau.",
    });
  };

  const requiredDocs = Object.entries(docs).filter(([, d]) => d.required);
  const allRequiredUploaded = requiredDocs.every(([, d]) => d.uploaded);

  const displayDocs = Object.entries(docs).filter(
    ([key]) => key !== "authorization" || title === "authorized_person"
  );

  return (
    <div className="space-y-5">
      <div>
        <h3 className="font-semibold text-base text-foreground mb-1">Upload giấy tờ</h3>
        <p className="text-sm text-muted-foreground">
          Tải lên các giấy tờ cần thiết để hoàn tất hồ sơ KYC.
        </p>
      </div>

      {title === "authorized_person" && (
        <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
          <Info className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-amber-600" />
          <span>
            Vì bạn là <strong>người được ủy quyền</strong>, cần upload thêm Giấy ủy quyền có công chứng.
          </span>
        </div>
      )}

      <div className="space-y-2.5">
        {displayDocs.map(([key, doc]) => (
          <DocUploadRow key={key} doc={{ ...doc, key }} onUpload={handleUpload} />
        ))}
      </div>

      <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground space-y-1">
        <p className="font-medium text-foreground text-[13px]">Lưu ý khi upload</p>
        <ul className="space-y-0.5 list-disc list-inside">
          <li>Định dạng chấp nhận: PDF, JPG, PNG (tối đa 10MB mỗi file)</li>
          <li>Hình ảnh rõ nét, không bị mờ, không bị che khuất</li>
          <li>Giấy tờ phải còn hiệu lực tại thời điểm nộp hồ sơ</li>
        </ul>
      </div>

      <div className="flex gap-3">
        <Button variant="outline" onClick={onBack} className="flex-1">
          Quay lại
        </Button>
        <Button variant="outline" onClick={handleSaveDraft} className="gap-1.5">
          <Save className="h-4 w-4" />
          Lưu nháp
        </Button>
        <Button onClick={onNext} disabled={!allRequiredUploaded} className="flex-1">
          Nộp hồ sơ
          <ArrowRight className="ml-1.5 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};
