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
import { Loader2, Save, CheckCircle2, Coins, CalendarIcon, ShieldCheck, ShieldAlert } from "lucide-react";
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

export const ProfileBasicSection = ({ initialName, onNameChange }: Props) => {
  const { agentInfo, tasks, refresh } = useOnboardingTasks();
  const sectionRef = useRef<HTMLDivElement>(null);

  const basic = agentInfo?.basic ?? {};
  const initialBirth = basic.birth_date
    ? basic.birth_date
    : basic.birth_year
    ? `${basic.birth_year}-01-01`
    : "";
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
  const [wasReadyBefore, setWasReadyBefore] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  // Sync from server snapshot when it changes
  useEffect(() => {
    setName(initialName);
  }, [initialName]);
  useEffect(() => {
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
    // If user edits to a number different from the verified one, reset verified state
    if (cleaned.trim() !== verifiedPhone.trim()) {
      setPhoneVerified(false);
    } else if (verifiedPhone) {
      // editing back to the verified number — restore verified state
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

    const wasComplete = isBasicComplete(basic, initialName);
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

    // Trigger celebration if just became ready & not claimed
    if (!wasComplete && willBeComplete && !agentInfo?.rewards?.basic_claimed_at) {
      setWasReadyBefore(true);
      setTimeout(() => setShowClaim(true), 300);
    }
  };

  return (
    <Card ref={sectionRef} id="basic" className="p-6 scroll-mt-24">
      <div className="flex items-start justify-between gap-3 mb-5">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Thông tin cơ bản</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Giúp xác thực tài khoản & cá nhân hóa trải nghiệm</p>
        </div>
        {status === "claimed" ? (
          <Badge variant="secondary" className="gap-1">
            <CheckCircle2 className="h-3 w-3" /> Đã nhận thưởng
          </Badge>
        ) : status === "ready" ? (
          <Badge className="gap-1 bg-primary/15 text-primary hover:bg-primary/20">
            <Coins className="h-3 w-3" /> +{REWARD_BASIC_CREDITS} chờ nhận
          </Badge>
        ) : (
          <Badge variant="outline" className="gap-1">
            <Coins className="h-3 w-3" /> +{REWARD_BASIC_CREDITS} sau khi hoàn thành
          </Badge>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="b-name">Họ tên</Label>
          <Input id="b-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nhập họ tên đầy đủ" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="b-phone">Số điện thoại</Label>
          <Input
            id="b-phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/[^0-9+]/g, ""))}
            placeholder="VD: 0987654321"
            inputMode="tel"
          />
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
                    // store as yyyy-mm-dd to avoid timezone offset issues
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
                disabled={(date) =>
                  date > new Date() || date < new Date("1940-01-01")
                }
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

      <div className="flex items-center justify-between mt-6">
        <p className="text-xs text-muted-foreground inline-flex items-center gap-1">
          {filledOk ? (
            <>
              <CheckCircle2 className="h-3.5 w-3.5 text-primary" /> Đã đủ thông tin
            </>
          ) : (
            "Điền đầy đủ để mở khóa thưởng"
          )}
        </p>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4" /> Lưu thông tin</>}
        </Button>
      </div>

      <RewardClaimDialog open={showClaim} onOpenChange={setShowClaim} taskKey="basic" />
    </Card>
  );
};
