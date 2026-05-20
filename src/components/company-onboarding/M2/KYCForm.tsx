import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  Building2, UserCheck, User, FileText, Camera, Upload, CheckCircle2,
  Shield, Info, ArrowRight, Phone, Mail, Save, PhoneCall,
} from "lucide-react";
import { toast } from "sonner";
import { AuctionCompany } from "@/lib/mockAuctionCompanies";
import { CompanyTypeahead } from "./CompanyTypeahead";
import { ReviewPanel } from "./ReviewPanel";
import { TrustSignals } from "./TrustSignals";
import { sectionStatus, KYCFormData } from "./sectionStatus";

interface KYCFormProps {
  accountEmail: string;
  onSubmit: (companyId: string) => void;
}

type IdType = "cccd" | "passport";

/* ─── UploadZone: photo tile ─── */
const UploadZone = ({
  label,
  uploaded,
  onUpload,
}: {
  label: string;
  uploaded: boolean;
  onUpload: () => void;
}) =>
  uploaded ? (
    <div
      className="w-full rounded-xl p-4 flex flex-col items-center gap-1.5 bg-green-100 cursor-pointer"
      onClick={onUpload}
    >
      <div className="w-10 h-10 rounded-full bg-green-200 flex items-center justify-center">
        <CheckCircle2 className="h-5 w-5 text-green-600" />
      </div>
      <span className="text-[11px] font-medium text-green-700 text-center">Đã tải lên</span>
    </div>
  ) : (
    <button
      onClick={onUpload}
      className="w-full border-2 border-dashed rounded-xl p-4 flex flex-col items-center gap-1.5 transition-all border-border hover:border-primary/50 hover:bg-muted/30"
    >
      <Camera className="h-5 w-5 text-muted-foreground" />
      <span className="text-[11px] text-muted-foreground text-center">{label}</span>
      <span className="text-[11px] text-primary font-medium">Nhấn để tải lên</span>
    </button>
  );

/* ─── DocUploadRow: shows filename after upload ─── */
const DocUploadRow = ({
  label,
  required,
  fileInfo,
  onUpload,
  onDelete,
}: {
  label: string;
  required: boolean;
  fileInfo?: { name: string; size: string };
  onUpload: () => void;
  onDelete: () => void;
}) => {
  if (fileInfo) {
    return (
      <div className="flex items-center gap-3 p-3 rounded-xl border border-green-300 bg-green-50">
        <div className="w-9 h-9 rounded-lg bg-green-100 flex-shrink-0 flex items-center justify-center">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">{label}</p>
          <p className="text-xs text-muted-foreground">
            {fileInfo.name} · {fileInfo.size}
          </p>
        </div>
        <div className="flex gap-1.5 flex-shrink-0">
          <button
            onClick={onUpload}
            className="text-xs text-primary px-2.5 py-1 rounded-lg hover:bg-primary/10 transition-colors font-medium"
          >
            Thay
          </button>
          <button
            onClick={onDelete}
            className="text-xs text-destructive px-2.5 py-1 rounded-lg hover:bg-red-50 transition-colors font-medium"
          >
            Xóa
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl border border-border">
      <div className="w-9 h-9 rounded-lg bg-muted flex-shrink-0 flex items-center justify-center">
        <FileText className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <p className="text-sm font-medium text-foreground">{label}</p>
          {required && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              Bắt buộc
            </Badge>
          )}
        </div>
      </div>
      <button
        onClick={onUpload}
        className="flex-shrink-0 flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg text-primary bg-primary/10 hover:bg-primary/20 transition-all"
      >
        <Upload className="h-3.5 w-3.5" />
        Tải lên
      </button>
    </div>
  );
};

/* ─── SectionCard ─── */
const SectionCard = ({
  id,
  title,
  done,
  flash,
  children,
}: {
  id: "a" | "b" | "c" | "d";
  title: string;
  done: boolean;
  flash: boolean;
  children: React.ReactNode;
}) => (
  <Card
    id={`kyc-section-${id}`}
    className={`p-5 transition-all duration-300 ${flash ? "ring-2 ring-primary/40" : ""}`}
  >
    <div className="flex items-center gap-2 mb-4">
      <div
        className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-[11px] font-bold ${
          done ? "bg-green-100" : "bg-primary/10"
        }`}
      >
        {done ? (
          <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
        ) : (
          <span className="text-primary uppercase">{id}</span>
        )}
      </div>
      <h3 className="font-semibold text-sm text-foreground">{title}</h3>
      {done && (
        <Badge variant="outline" className="ml-auto border-green-300 text-green-600 text-[10px]">
          Hoàn thành
        </Badge>
      )}
    </div>
    {children}
  </Card>
);

const FAKE_FILES: Record<string, { name: string; size: string }> = {
  dkdn: { name: "DKDN_CongTy.pdf", size: "2.4 MB" },
  auctionLicense: { name: "GiayPhepDauGia.pdf", size: "1.8 MB" },
  authorization: { name: "GiayUyQuyen_CongChung.pdf", size: "1.1 MB" },
};

/* ─── Main KYCForm ─── */
export const KYCForm = ({ accountEmail, onSubmit }: KYCFormProps) => {
  // Section A
  const [company, setCompany] = useState<AuctionCompany | null>(null);

  // Section B
  const [role, setRole] = useState<"legal_rep" | "authorized_person" | "">("");

  // Section C
  const [fullName, setFullName] = useState("");
  const [idType, setIdType] = useState<IdType>("cccd");
  const [idNumber, setIdNumber] = useState("");
  const [idFront, setIdFront] = useState(false);
  const [idBack, setIdBack] = useState(false);
  const [selfie, setSelfie] = useState(false);
  const [phone, setPhone] = useState("");
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [contactEmail, setContactEmail] = useState(accountEmail);
  const [emailVerified, setEmailVerified] = useState(false);
  const [otpOpen, setOtpOpen] = useState(false);
  const [otp, setOtp] = useState("");

  // Section D
  const [docDkdn, setDocDkdn] = useState(false);
  const [docLicense, setDocLicense] = useState(false);
  const [docAuth, setDocAuth] = useState(false);
  const [docsFiles, setDocsFiles] = useState<Record<string, { name: string; size: string }>>({});

  // Footer
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Flash for ReviewPanel jump
  const [flashSection, setFlashSection] = useState<"a" | "b" | "c" | "d" | null>(null);

  // Assembled form for sectionStatus
  const form: KYCFormData = {
    company,
    role,
    fullName,
    idType,
    idNumber,
    idFront,
    idBack,
    selfie,
    phoneVerified,
    emailVerified,
    doc_dkdn: docDkdn,
    doc_license: docLicense,
    doc_auth: docAuth,
    acceptedTerms,
  };
  const status = sectionStatus(form);

  const handleJump = (id: "a" | "b" | "c" | "d") => {
    const el = document.getElementById(`kyc-section-${id}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      setFlashSection(id);
      setTimeout(() => setFlashSection(null), 1200);
    }
  };

  const handleSimUpload = (setter: (v: boolean) => void) => {
    setTimeout(() => {
      setter(true);
      toast.success("Tải lên thành công (demo)");
    }, 400);
  };

  const handleDocUpload = (field: "dkdn" | "auctionLicense" | "authorization") => {
    setTimeout(() => {
      if (field === "dkdn") setDocDkdn(true);
      else if (field === "auctionLicense") setDocLicense(true);
      else setDocAuth(true);
      setDocsFiles((p) => ({ ...p, [field]: FAKE_FILES[field] }));
      toast.success("Tải lên thành công (demo)");
    }, 400);
  };

  const handleDocDelete = (field: "dkdn" | "auctionLicense" | "authorization") => {
    if (field === "dkdn") setDocDkdn(false);
    else if (field === "auctionLicense") setDocLicense(false);
    else setDocAuth(false);
    setDocsFiles((p) => {
      const next = { ...p };
      delete next[field];
      return next;
    });
  };

  const handleVerifyOtp = () => {
    if (otp.length < 6) return;
    setOtpOpen(false);
    setOtp("");
    setPhoneVerified(true);
    toast.success("Xác thực số điện thoại thành công");
  };

  const handleVerifyEmail = () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
      toast.error("Email không đúng định dạng");
      return;
    }
    setEmailVerified(true);
    toast.success("Đã gửi link xác thực (demo: coi như đã xác thực)");
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Đăng ký tổ chức đấu giá
        </h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-xl">
          Điền thông tin KYC để liên kết công ty với tài khoản. Bạn có thể lưu nháp và quay lại bất kỳ lúc nào.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6 items-start">
        {/* ── Left: form sections ── */}
        <div className="space-y-4 min-w-0">

          {/* Section A */}
          <SectionCard id="a" title="Công ty đấu giá" done={status.a.done} flash={flashSection === "a"}>
            <CompanyTypeahead value={company} onSelect={setCompany} />
          </SectionCard>

          {/* Section B */}
          <SectionCard id="b" title="Chức danh của bạn" done={status.b.done} flash={flashSection === "b"}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                {
                  value: "legal_rep" as const,
                  icon: Shield,
                  title: "Người đại diện theo pháp luật",
                  desc: "Giám đốc / Tổng giám đốc ghi trong ĐKDN",
                  perks: ["Không cần giấy ủy quyền", "Thẩm quyền ký kết toàn diện"],
                },
                {
                  value: "authorized_person" as const,
                  icon: UserCheck,
                  title: "Người được ủy quyền",
                  desc: "Đại diện theo giấy ủy quyền công chứng",
                  perks: ["Cần Giấy ủy quyền (mục D)", "Quyền hạn theo phạm vi ủy quyền"],
                },
              ].map(({ value, icon: Icon, title, desc, perks }) => (
                <div
                  key={value}
                  onClick={() => setRole(value)}
                  className={`rounded-2xl border-2 p-4 cursor-pointer transition-all space-y-2 ${
                    role === value
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/30"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                        role === value ? "bg-primary/10" : "bg-muted"
                      }`}
                    >
                      <Icon
                        className={`h-4 w-4 ${
                          role === value ? "text-primary" : "text-muted-foreground"
                        }`}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="font-semibold text-xs text-foreground leading-tight">{title}</p>
                        {role === value && (
                          <CheckCircle2 className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{desc}</p>
                    </div>
                  </div>
                  <div className="space-y-1 pl-12">
                    {perks.map((perk) => (
                      <div key={perk} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <div className="w-1 h-1 rounded-full bg-muted-foreground/50 flex-shrink-0" />
                        {perk}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            {role === "authorized_person" && (
              <div className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 p-2.5 text-xs text-amber-800">
                <Info className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-amber-600" />
                <span>
                  Bạn sẽ cần upload <strong>Giấy ủy quyền</strong> (có công chứng) ở mục D bên dưới.
                </span>
              </div>
            )}
          </SectionCard>

          {/* Section C */}
          <SectionCard
            id="c"
            title="Định danh người đăng ký"
            done={status.c.done}
            flash={flashSection === "c"}
          >
            <div className="space-y-4">
              {/* Họ và tên */}
              <div className="space-y-1.5">
                <Label className="text-xs">Họ và tên</Label>
                <Input
                  placeholder="Nguyễn Văn A"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>

              {/* Loại giấy tờ */}
              <div className="space-y-2">
                <Label className="text-xs">Loại giấy tờ định danh</Label>
                <RadioGroup
                  value={idType}
                  onValueChange={(v) => {
                    setIdType(v as IdType);
                    setIdNumber("");
                  }}
                  className="flex gap-4"
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="cccd" id="c-cccd" />
                    <Label htmlFor="c-cccd" className="text-xs font-normal cursor-pointer">
                      CCCD / CMND
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="passport" id="c-passport" />
                    <Label htmlFor="c-passport" className="text-xs font-normal cursor-pointer">
                      Hộ chiếu
                    </Label>
                  </div>
                </RadioGroup>
                <Input
                  placeholder={idType === "cccd" ? "Số CCCD (9–12 chữ số)" : "Số hộ chiếu (≥ 6 ký tự)"}
                  value={idNumber}
                  onChange={(e) => setIdNumber(e.target.value)}
                />
              </div>

              {/* Photo uploads */}
              <div className="space-y-1.5">
                <Label className="text-xs">
                  Ảnh {idType === "cccd" ? "CCCD" : "Hộ chiếu"} + selfie
                </Label>
                <div className="grid grid-cols-3 gap-2">
                  <UploadZone
                    label="Mặt trước"
                    uploaded={idFront}
                    onUpload={() => handleSimUpload(setIdFront)}
                  />
                  <UploadZone
                    label="Mặt sau"
                    uploaded={idBack}
                    onUpload={() => handleSimUpload(setIdBack)}
                  />
                  <UploadZone
                    label="Selfie kèm GT"
                    uploaded={selfie}
                    onUpload={() => handleSimUpload(setSelfie)}
                  />
                </div>
              </div>

              {/* Phone */}
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1">
                  <Phone className="h-3 w-3 text-muted-foreground" />
                  Số điện thoại
                  {phoneVerified && <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />}
                </Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="0912345678"
                    value={phone}
                    onChange={(e) => {
                      setPhone(e.target.value);
                      setPhoneVerified(false);
                    }}
                    disabled={phoneVerified}
                    className="flex-1"
                  />
                  {!phoneVerified && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="whitespace-nowrap text-xs"
                      onClick={() => {
                        if (!phone.match(/^0[0-9]{9}$/)) {
                          toast.error("SĐT không hợp lệ (10 chữ số, bắt đầu bằng 0)");
                          return;
                        }
                        setOtpOpen(true);
                        toast.info("Đã gửi OTP đến " + phone);
                      }}
                    >
                      Gửi OTP
                    </Button>
                  )}
                </div>
              </div>

              {/* Email liên hệ */}
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1">
                  <Mail className="h-3 w-3 text-muted-foreground" />
                  Email liên hệ
                  {emailVerified && <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />}
                </Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="email@example.com"
                    type="email"
                    value={contactEmail}
                    onChange={(e) => {
                      setContactEmail(e.target.value);
                      setEmailVerified(false);
                    }}
                    disabled={emailVerified}
                    className="flex-1"
                  />
                  {!emailVerified && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="whitespace-nowrap text-xs"
                      onClick={handleVerifyEmail}
                    >
                      Xác thực
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </SectionCard>

          {/* Section D */}
          <SectionCard id="d" title="Giấy tờ pháp lý" done={status.d.done} flash={flashSection === "d"}>
            <div className="space-y-2">
              <DocUploadRow
                label="Bản sao công chứng ĐKDN"
                required
                fileInfo={docsFiles.dkdn}
                onUpload={() => handleDocUpload("dkdn")}
                onDelete={() => handleDocDelete("dkdn")}
              />
              <DocUploadRow
                label="Giấy phép hoạt động đấu giá tài sản"
                required
                fileInfo={docsFiles.auctionLicense}
                onUpload={() => handleDocUpload("auctionLicense")}
                onDelete={() => handleDocDelete("auctionLicense")}
              />
              {role === "authorized_person" && (
                <DocUploadRow
                  label="Giấy ủy quyền (có công chứng)"
                  required
                  fileInfo={docsFiles.authorization}
                  onUpload={() => handleDocUpload("authorization")}
                  onDelete={() => handleDocDelete("authorization")}
                />
              )}
            </div>
            <div className="mt-3 bg-muted/40 rounded-lg p-2.5 text-[11px] text-muted-foreground space-y-0.5">
              <p className="font-medium text-xs text-foreground">Lưu ý khi upload</p>
              <p>Định dạng: PDF, JPG, PNG (tối đa 10MB). Hình ảnh rõ nét, còn hiệu lực.</p>
            </div>
          </SectionCard>

          {/* Footer: Checkbox + Submit */}
          <Card className="p-5">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <label className="flex items-start gap-2.5 flex-1 cursor-pointer">
                <Checkbox
                  checked={acceptedTerms}
                  onCheckedChange={(c) => setAcceptedTerms(!!c)}
                  className="mt-0.5 flex-shrink-0"
                />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Tôi xác nhận thông tin trên là chính xác và đồng ý với{" "}
                  <a href="/dieu-khoan" className="text-primary underline underline-offset-2">
                    Điều khoản sử dụng
                  </a>{" "}
                  của nền tảng.
                </p>
              </label>
              <div className="flex gap-2 flex-shrink-0 w-full sm:w-auto">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() =>
                    toast.success("Đã lưu nháp hồ sơ", {
                      description: "Bạn có thể tiếp tục hoàn thiện sau.",
                    })
                  }
                >
                  <Save className="h-4 w-4" />
                  Lưu nháp
                </Button>
                <Button
                  size="sm"
                  className="flex-1 sm:flex-none"
                  disabled={!status.all || !acceptedTerms || submitting}
                  onClick={() => {
                    setSubmitting(true);
                    onSubmit(company!.id);
                  }}
                >
                  {submitting ? "Đang xử lý..." : "Nộp hồ sơ KYC"}
                  {!submitting && <ArrowRight className="ml-1.5 h-4 w-4" />}
                </Button>
              </div>
            </div>
          </Card>
        </div>

        {/* ── Right: sticky sidebar ── */}
        <aside className="space-y-4 lg:sticky lg:top-4">
          <Card className="p-5">
            <ReviewPanel form={form} status={status} onJump={handleJump} />
          </Card>
          <Card className="p-5">
            <TrustSignals />
          </Card>
          <div className="px-1">
            <p className="text-xs text-muted-foreground mb-2">Cần hỗ trợ?</p>
            <Button variant="outline" size="sm" onClick={() => window.open("/lien-he", "_blank")}>
              <PhoneCall className="mr-1.5 h-4 w-4" />
              Liên hệ ngay
            </Button>
          </div>
        </aside>
      </div>

      {/* OTP Dialog */}
      <Dialog open={otpOpen} onOpenChange={setOtpOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Xác thực số điện thoại</DialogTitle>
            <DialogDescription>
              Nhập mã OTP 6 chữ số đã gửi đến <strong>{phone}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center py-2">
            <InputOTP maxLength={6} value={otp} onChange={setOtp}>
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
                <InputOTPSlot index={3} />
                <InputOTPSlot index={4} />
                <InputOTPSlot index={5} />
              </InputOTPGroup>
            </InputOTP>
          </div>
          <p className="text-xs text-center text-muted-foreground">
            Prototype: nhập bất kỳ 6 chữ số nào
          </p>
          <Button onClick={handleVerifyOtp} disabled={otp.length < 6} className="w-full">
            Xác nhận
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
};
