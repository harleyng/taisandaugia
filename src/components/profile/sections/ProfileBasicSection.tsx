import { useEffect, useRef, useState } from "react";
import { format, parseISO, isValid } from "date-fns";
import { vi } from "date-fns/locale";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Loader2, Save, CheckCircle2, Coins, CalendarIcon, ShieldCheck, ShieldAlert, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  GENDER_OPTIONS,
  ROLE_OPTIONS,
  isBasicComplete,
  AgentInfoShape,
  Gender,
  UserRole,
  REWARD_BASIC_CREDITS,
} from "@/lib/onboardingTasks";
import { vietnamProvinces } from "@/constants/vietnam-locations";
import { notifyProfileUpdated, useOnboardingTasks } from "@/hooks/useOnboardingTasks";
import { RewardClaimDialog } from "@/components/onboarding/RewardClaimDialog";
import { PhoneOtpDialog } from "@/components/profile/sections/PhoneOtpDialog";
import { cn } from "@/lib/utils";

interface Props {
  initialName: string;
  onNameChange: (n: string) => void;
}

const labelOf = (options: { value: string; label: string }[], value: string) =>
  options.find((o) => o.value === value)?.label ?? "";

export const ProfileBasicSection = ({ initialName, onNameChange }: Props) => {
  const { agentInfo, tasks, refresh } = useOnboardingTasks();
  const sectionRef = useRef<HTMLDivElement>(null);

  const basic = agentInfo?.basic ?? {};
  const initialBirth = basic.birth_date
    ? basic.birth_date
    : basic.birth_year
    ? `${basic.birth_year}-01-01`
    : "";
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState(basic.phone ?? "");
  const [phoneVerified, setPhoneVerified] = useState(Boolean(basic.phone_verified));
  const [verifiedPhone, setVerifiedPhone] = useState(basic.phone_verified ? basic.phone ?? "" : "");
  const [otpOpen, setOtpOpen] = useState(false);
  const [role, setRole] = useState<UserRole | "">((basic.role as UserRole) ?? "");
  const [province, setProvince] = useState(basic.province ?? "");
  const [birthDate, setBirthDate] = useState<string>(initialBirth);
  const [gender, setGender] = useState<Gender | "">((basic.gender as Gender) ?? "");
  const [saving, setSaving] = useState(false);
  const [showClaim, setShowClaim] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  const resetFromSnapshot = () => {
    setName(initialName);
    setPhone(basic.phone ?? "");
    setPhoneVerified(Boolean(basic.phone_verified));
    setVerifiedPhone(basic.phone_verified ? basic.phone ?? "" : "");
    setRole((basic.role as UserRole) ?? "");
    setProvince(basic.province ?? "");
    setBirthDate(
      basic.birth_date
        ? basic.birth_date
        : basic.birth_year
        ? `${basic.birth_year}-01-01`
        : ""
    );
    setGender((basic.gender as Gender) ?? "");
  };

  // Sync from server snapshot when it changes
  useEffect(() => {
    setName(initialName);
  }, [initialName]);
  useEffect(() => {
    resetFromSnapshot();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentInfo]);

  // Scroll to section when hash matches
  useEffect(() => {
    if (window.location.hash === "#basic" && sectionRef.current) {
      setTimeout(() => sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    }
  }, []);

  const basicTask = tasks.find((t) => t.key === "basic");
  const status = basicTask?.status ?? "todo";

  const birthDateObj = birthDate ? parseISO(birthDate) : undefined;
  const validBirth = birthDateObj && isValid(birthDateObj) ? birthDateObj : undefined;

  const PHONE_REGEX = /^(0|\+84)[0-9]{9,10}$/;
  const phoneIsValid = PHONE_REGEX.test(phone.trim());
  const isCurrentPhoneVerified = phoneVerified && phone.trim() === verifiedPhone.trim() && phone.trim() !== "";

  const handlePhoneChange = (value: string) => {
    const cleaned = value.replace(/[^0-9+]/g, "");
    setPhone(cleaned);
    if (cleaned.trim() !== verifiedPhone.trim()) {
      setPhoneVerified(false);
    } else if (verifiedPhone) {
      setPhoneVerified(true);
    }
  };

  const handleOtpVerified = () => {
    setPhoneVerified(true);
    setVerifiedPhone(phone.trim());
  };

  const handleResetPhone = () => {
    setPhoneVerified(false);
    setVerifiedPhone("");
    setPhone("");
  };

  const filledOk = Boolean(
    name.trim() && phone && isCurrentPhoneVerified && role && province && birthDate && gender
  );

  const handleCancel = () => {
    resetFromSnapshot();
    setMode("view");
  };

  const handleSave = async () => {
    if (phone && !isCurrentPhoneVerified) {
      toast.error("Vui lòng xác thực số điện thoại trước khi lưu");
      return;
    }
    setSaving(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setSaving(false);
      toast.error("Bạn cần đăng nhập");
      return;
    }

    const nextBasic = {
      phone: phone || undefined,
      phone_verified: phone ? isCurrentPhoneVerified : false,
      role: (role || undefined) as UserRole | undefined,
      province: province || undefined,
      birth_date: birthDate || undefined,
      birth_year: validBirth ? validBirth.getFullYear() : undefined,
      gender: (gender || undefined) as Gender | undefined,
    };

    const willBeComplete = isBasicComplete(nextBasic, name);

    const nextAgentInfo: AgentInfoShape = {
      ...(agentInfo ?? {}),
      basic: nextBasic,
      rewards: {
        ...(agentInfo?.rewards ?? {}),
        basic_completed_at:
          willBeComplete
            ? agentInfo?.rewards?.basic_completed_at ?? Date.now()
            : agentInfo?.rewards?.basic_completed_at ?? null,
      },
    };

    const { error } = await supabase
      .from("profiles")
      .update({
        name: name.trim() || null,
        agent_info: nextAgentInfo as never,
      })
      .eq("id", session.user.id);

    setSaving(false);

    if (error) {
      toast.error("Không thể lưu thông tin");
      return;
    }

    onNameChange(name);
    toast.success("Đã lưu thông tin");
    notifyProfileUpdated();
    await refresh();

    setMode("view");

    if (willBeComplete) {
      setTimeout(() => setShowClaim(true), 300);
    }
  };

  const renderBadge = () => {
    if (status === "claimed") {
      return (
        <Badge variant="secondary" className="gap-1">
          <CheckCircle2 className="h-3 w-3" /> Đã nhận thưởng
        </Badge>
      );
    }
    if (status === "ready") {
      return (
        <Badge className="gap-1 bg-primary/15 text-primary hover:bg-primary/20">
          <Coins className="h-3 w-3" /> +{REWARD_BASIC_CREDITS} chờ nhận
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="gap-1">
        <Coins className="h-3 w-3" /> +{REWARD_BASIC_CREDITS} sau khi hoàn thành
      </Badge>
    );
  };

  const ViewField = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="text-sm text-foreground">{children}</div>
    </div>
  );

  const empty = <span className="text-muted-foreground italic">Chưa cập nhật</span>;

  return (
    <Card ref={sectionRef} id="basic" className="p-6 scroll-mt-24">
      <div className="flex items-start justify-between gap-3 mb-5">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Thông tin cơ bản</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Giúp xác thực tài khoản & cá nhân hóa trải nghiệm</p>
        </div>
        <div className="flex items-center gap-2">
          {renderBadge()}
          {mode === "view" && (
            <Button variant="outline" size="sm" onClick={() => setMode("edit")}>
              <Pencil className="h-4 w-4" /> Chỉnh sửa
            </Button>
          )}
        </div>
      </div>

      {mode === "view" ? (
        <div className="grid gap-5 md:grid-cols-2">
          <ViewField label="Họ tên">{initialName?.trim() ? initialName : empty}</ViewField>
          <ViewField label="Số điện thoại">
            {basic.phone ? (
              <span className="inline-flex items-center gap-2">
                {basic.phone}
                {basic.phone_verified && (
                  <Badge variant="secondary" className="gap-1 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20 border-0 font-normal">
                    <ShieldCheck className="h-3 w-3" /> Đã xác thực
                  </Badge>
                )}
              </span>
            ) : (
              empty
            )}
          </ViewField>
          <ViewField label="Vai trò">{basic.role ? labelOf(ROLE_OPTIONS, basic.role) : empty}</ViewField>
          <ViewField label="Tỉnh/Thành phố">{basic.province || empty}</ViewField>
          <ViewField label="Ngày sinh">
            {validBirth ? format(validBirth, "dd/MM/yyyy", { locale: vi }) : empty}
          </ViewField>
          <ViewField label="Giới tính">{basic.gender ? labelOf(GENDER_OPTIONS, basic.gender) : empty}</ViewField>
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="b-name">Họ tên</Label>
              <Input id="b-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nhập họ tên đầy đủ" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="b-phone" className="flex items-center gap-2">
                Số điện thoại
                {isCurrentPhoneVerified && (
                  <Badge variant="secondary" className="gap-1 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20 border-0 font-normal">
                    <ShieldCheck className="h-3 w-3" /> Đã xác thực
                  </Badge>
                )}
              </Label>
              <div className="flex gap-2">
                <Input
                  id="b-phone"
                  value={phone}
                  onChange={(e) => handlePhoneChange(e.target.value)}
                  placeholder="VD: 0987654321"
                  inputMode="tel"
                  disabled={isCurrentPhoneVerified}
                  className={cn(isCurrentPhoneVerified && "bg-muted/50 text-muted-foreground")}
                />
                {isCurrentPhoneVerified ? (
                  <Button type="button" variant="outline" onClick={handleResetPhone} className="shrink-0">
                    Đổi số khác
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant={phoneIsValid ? "default" : "outline"}
                    onClick={() => setOtpOpen(true)}
                    disabled={!phoneIsValid}
                    className="shrink-0"
                  >
                    <ShieldCheck className="h-4 w-4" />
                    Xác thực
                  </Button>
                )}
              </div>
              {phone && !phoneIsValid && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <ShieldAlert className="h-3 w-3" />
                  Số điện thoại không hợp lệ
                </p>
              )}
              {phone && phoneIsValid && !isCurrentPhoneVerified && (
                <p className="text-xs text-amber-600 dark:text-amber-500 flex items-center gap-1">
                  <ShieldAlert className="h-3 w-3" />
                  Số điện thoại chưa được xác thực
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="b-role">Vai trò</Label>
              <Select value={role} onValueChange={(v) => setRole(v as UserRole)}>
                <SelectTrigger id="b-role">
                  <SelectValue placeholder="Chọn vai trò" />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="b-province">Tỉnh/Thành phố</Label>
              <Select value={province} onValueChange={setProvince}>
                <SelectTrigger id="b-province">
                  <SelectValue placeholder="Chọn tỉnh/thành" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {vietnamProvinces.map((p) => (
                    <SelectItem key={p.name} value={p.name}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="b-birth">Ngày sinh</Label>
              <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    id="b-birth"
                    type="button"
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !validBirth && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4 opacity-70" />
                    {validBirth ? format(validBirth, "dd/MM/yyyy", { locale: vi }) : <span>Chọn ngày sinh</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={validBirth}
                    onSelect={(d) => {
                      if (d) {
                        setBirthDate(format(d, "yyyy-MM-dd"));
                        setDatePickerOpen(false);
                      } else {
                        setBirthDate("");
                      }
                    }}
                    captionLayout="dropdown-buttons"
                    fromYear={1940}
                    toYear={new Date().getFullYear() - 10}
                    defaultMonth={validBirth ?? new Date(1995, 0, 1)}
                    disabled={(date) => date > new Date() || date < new Date("1940-01-01")}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label htmlFor="b-gender">Giới tính</Label>
              <Select value={gender} onValueChange={(v) => setGender(v as Gender)}>
                <SelectTrigger id="b-gender">
                  <SelectValue placeholder="Chọn giới tính" />
                </SelectTrigger>
                <SelectContent>
                  {GENDER_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between mt-6 gap-3">
            <p className="text-xs text-muted-foreground inline-flex items-center gap-1">
              {filledOk ? (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5 text-primary" /> Đã đủ thông tin
                </>
              ) : (
                "Điền đầy đủ để mở khóa thưởng"
              )}
            </p>
            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={handleCancel} disabled={saving}>
                Hủy
              </Button>
              <Button onClick={handleSave} disabled={saving || (Boolean(phone) && !isCurrentPhoneVerified)}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4" /> Lưu thông tin</>}
              </Button>
            </div>
          </div>
        </>
      )}

      <RewardClaimDialog open={showClaim} onOpenChange={setShowClaim} taskKey="basic" />
      <PhoneOtpDialog
        open={otpOpen}
        phone={phone}
        onOpenChange={setOtpOpen}
        onVerified={handleOtpVerified}
      />
    </Card>
  );
};
