import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { VneidButton } from "@/components/vneid/VneidButton";
import { VneidConsentDialog } from "@/components/vneid/VneidConsentDialog";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { useMyBiddingContracts, useStartBiddingContract } from "@/hooks/useBiddingContracts";
import { useVerifiedIdentity } from "@/hooks/useVneidIdentity";
import { formatVnd } from "@/lib/advertising/slug";
import {
  applyVerifiedIdentity,
  identityDefaults,
  identityFormSchema,
  identityToRpcArgs,
  matchesVerifiedIdentity,
  type IdentityFormValues,
} from "@/lib/biddingContracts/identityForm";
import { contractCheckoutPath } from "@/lib/biddingContracts/paths";
import { GENDER_LABELS, ID_TYPE_LABELS } from "@/types/bidding-contract";
import type { PublicSessionDetail } from "@/types/auction-session";

const NO_GENDER = "__none__";

interface Props {
  session: PublicSessionDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Khai danh tính → giữ chỗ 15 phút → sang VNPay. Có danh tính VNeID thì điền sẵn
 * và khoá các trường đã xác thực; "Nhập thông tin khác" mở khoá (server khi đó
 * ghi nhận là nhập tay nếu họ tên / CCCD không còn khớp).
 */
export function BuyContractDialog({ session, open, onOpenChange }: Props) {
  const navigate = useNavigate();
  const { userId, session: authSession } = useAuth();
  const { data: profile } = useProfile(userId);
  const { data: verified, isLoading: identityLoading } = useVerifiedIdentity();
  const { data: mine = [], isLoading: mineLoading } = useMyBiddingContracts();
  const start = useStartBiddingContract();
  const [vneidOpen, setVneidOpen] = useState(false);
  const [manual, setManual] = useState(false);

  const form = useForm<IdentityFormValues>({
    resolver: zodResolver(identityFormSchema),
    defaultValues: identityDefaults({}),
  });

  // Điền sẵn MỘT lần mỗi khi mở, sau khi danh tính + hồ sơ cũ đã tải xong.
  const ready = !identityLoading && !mineLoading;
  useEffect(() => {
    if (!open || !ready) return;
    form.reset(
      identityDefaults({
        profileName: profile?.name,
        authEmail: authSession?.user?.email,
        authPhone: authSession?.user?.phone,
        verified: verified ?? null,
        last: mine[0] ?? null,
      }),
    );
    setManual(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, ready]);

  const values = form.watch();
  const locked = !manual && matchesVerifiedIdentity(values, verified);
  const busy = start.isPending;
  const orgName = session.auction_organizations?.name ?? "tổ chức đấu giá";

  const onSubmit = (v: IdentityFormValues) => {
    start.mutate(identityToRpcArgs(session.id, v), {
      onSuccess: (r) => {
        onOpenChange(false);
        navigate(contractCheckoutPath(r.contract_id, session.id));
      },
    });
  };

  const useVerified = () => {
    if (!verified) return;
    form.reset(applyVerifiedIdentity(form.getValues(), verified));
    setManual(false);
  };

  const text = (name: "full_name" | "id_number" | "phone" | "email" | "address", label: string, extra?: object) => (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem className={name === "full_name" || name === "address" ? "sm:col-span-2" : undefined}>
          <FormLabel>
            {label} <span className="text-destructive">*</span>
          </FormLabel>
          <FormControl>
            <Input {...field} disabled={busy || (locked && (name === "full_name" || name === "id_number"))} {...extra} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => !busy && onOpenChange(v)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Mua hồ sơ tham gia đấu giá</DialogTitle>
            <DialogDescription>
              Phiên <span className="font-mono">{session.code}</span> · {session.title}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-muted px-4 py-3 text-sm">
            <span className="text-muted-foreground">Tiền hồ sơ</span>
            <span className="text-lg font-bold text-primary">{formatVnd(session.dossier_fee ?? 0)}</span>
          </div>

          {locked && verified ? (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
              <span className="flex items-center gap-2 font-medium text-primary">
                <ShieldCheck className="h-4 w-4" />
                Đã xác thực qua VNeID ngày {new Date(verified.verified_at).toLocaleDateString("vi-VN")}
              </span>
              <Button type="button" variant="link" size="sm" className="h-auto p-0" onClick={() => setManual(true)}>
                Nhập thông tin khác
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-border px-4 py-3">
              <div className="text-sm">
                <p className="font-medium text-foreground">Điền nhanh bằng VNeID</p>
                <p className="text-xs text-muted-foreground">Họ tên, CCCD, ngày sinh, địa chỉ được lấy từ ứng dụng định danh.</p>
              </div>
              {verified ? (
                <Button type="button" variant="outline" size="sm" onClick={useVerified}>
                  Dùng thông tin VNeID
                </Button>
              ) : (
                <VneidButton size="sm" onClick={() => setVneidOpen(true)} disabled={busy} />
              )}
            </div>
          )}

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                {text("full_name", "Họ và tên")}
                <FormField
                  control={form.control}
                  name="id_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Loại giấy tờ</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange} disabled={busy || locked}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.entries(ID_TYPE_LABELS).map(([value, label]) => (
                            <SelectItem key={value} value={value}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
                {text("id_number", "Số giấy tờ", { inputMode: values.id_type === "cccd" ? "numeric" : "text" })}
                <FormField
                  control={form.control}
                  name="date_of_birth"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ngày sinh</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} value={field.value ?? ""} disabled={busy || locked} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="gender"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Giới tính</FormLabel>
                      <Select
                        value={field.value || NO_GENDER}
                        onValueChange={(v) => field.onChange(v === NO_GENDER ? "" : v)}
                        disabled={busy || locked}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value={NO_GENDER}>Chưa chọn</SelectItem>
                          {Object.entries(GENDER_LABELS).map(([value, label]) => (
                            <SelectItem key={value} value={value}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
                {text("phone", "Số điện thoại", { inputMode: "tel", placeholder: "0912345678" })}
                {text("email", "Email", { type: "email" })}
                {text("address", "Địa chỉ liên hệ")}
              </div>

              <FormField
                control={form.control}
                name="consent"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-start gap-2">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={(v) => field.onChange(v === true)}
                          disabled={busy}
                          className="mt-0.5"
                        />
                      </FormControl>
                      <FormLabel className="text-sm font-normal leading-snug">
                        Tôi đồng ý chia sẻ các thông tin trên với {orgName} để lập hồ sơ tham gia đấu giá, và cam kết thông
                        tin là chính xác.
                      </FormLabel>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <p className="text-xs text-muted-foreground">
                Sau khi xác nhận, suất đăng ký được giữ 15 phút để bạn hoàn tất thanh toán.
              </p>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
                  Huỷ
                </Button>
                <Button type="submit" disabled={busy || !ready} className="gap-1.5">
                  {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                  Tiếp tục thanh toán
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <VneidConsentDialog
        open={vneidOpen}
        onOpenChange={setVneidOpen}
        onLinked={(identity) => {
          form.reset(applyVerifiedIdentity(form.getValues(), identity));
          setManual(false);
        }}
      />
    </>
  );
}
