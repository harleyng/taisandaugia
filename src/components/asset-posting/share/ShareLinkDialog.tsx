import { useEffect, useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { OutcomeFieldError } from "@/components/asset-owner-portal/outcomes/OutcomeFieldError";
import { useAuth } from "@/contexts/AuthContext";
import { useCreateShareLink, useShareSenders, useUpdateShareLink } from "@/hooks/usePostingShareLinks";
import { MKT_CHANNELS, MKT_CHANNEL_META } from "@/lib/ownerMarketing/links";
import { KEEP_EXPIRY, shareLinkDefaults, shareLinkSchema, toShareLinkInput, type ShareLinkForm } from "@/lib/postingShare/form";
import { SHARE_EXPIRY_OPTIONS, formatShareDay } from "@/lib/postingShare/status";
import type { PostingShareLink, ShareTarget } from "@/lib/postingShare/types";
import { ShareSenderCard } from "./ShareSenderCard";

interface ShareLinkDialogProps {
  /** Tài sản của link (hồ sơ số hoá hoặc tin trên sàn). */
  target: ShareTarget | null;
  /** Tên tài sản — hiện ở mô tả khi tạo từ trang tổng hợp. */
  targetTitle?: string | null;
  open: boolean;
  /** Có ⇒ sửa link này; không ⇒ tạo mới. */
  link: PostingShareLink | null;
  onClose: () => void;
}

const Req = () => <span className="text-destructive">*</span>;

function ToggleRow({ id, label, help, children }: { id: string; label: string; help: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-3">
      <Label htmlFor={id} className="text-sm font-medium leading-snug text-foreground">
        {label}
        <span className="mt-0.5 block text-xs font-normal text-muted-foreground">{help}</span>
      </Label>
      {children}
    </div>
  );
}

/**
 * Tạo / sửa link Hồ sơ online. Mỗi link là một người nhận (hoặc một nhóm) × một kênh để đếm
 * riêng. Tin trên sàn: giá đã công khai trên sàn nên luôn hiện (không có công tắc giá).
 */
export function ShareLinkDialog({ target, targetTitle, open, link, onClose }: ShareLinkDialogProps) {
  const { userId } = useAuth();
  const create = useCreateShareLink(target);
  const update = useUpdateShareLink();
  const sendersQ = useShareSenders(target, open);
  const isListing = target?.kind === "listing";
  const senders = useMemo(() => sendersQ.data ?? [], [sendersQ.data]);
  const form = useForm<ShareLinkForm>({
    resolver: zodResolver(shareLinkSchema),
    defaultValues: shareLinkDefaults(link, userId),
  });
  const busy = create.isPending || update.isPending;
  const errors = form.formState.errors;
  const editing = !!link;
  const senderUserId = form.watch("senderUserId");
  const showSenderContact = form.watch("showSenderContact");
  useEffect(() => {
    if (open) form.reset(shareLinkDefaults(link, userId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, link?.id]);

  // Người gửi đã rời đơn vị ⇒ bỏ chọn để không lưu một người server sẽ từ chối.
  useEffect(() => {
    if (!sendersQ.isSuccess || !senderUserId) return;
    if (!senders.some((s) => s.userId === senderUserId)) form.setValue("senderUserId", null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sendersQ.isSuccess, senders, senderUserId]);

  const submit = form.handleSubmit((values) => {
    const { input, changeExpiry } = toShareLinkInput(values);
    if (link) update.mutate({ linkId: link.id, input, changeExpiry }, { onSuccess: onClose });
    else create.mutate(input, { onSuccess: onClose });
  });

  const expiryOptions = editing
    ? [
        {
          value: KEEP_EXPIRY,
          label: link?.expiresAt ? `Giữ nguyên (đến ${formatShareDay(link.expiresAt)})` : "Giữ nguyên (không hết hạn)",
        },
        ...SHARE_EXPIRY_OPTIONS.map((o) => ({ value: o.value, label: o.days ? `${o.label} kể từ hôm nay` : o.label })),
      ]
    : SHARE_EXPIRY_OPTIONS.map((o) => ({ value: o.value, label: o.label }));

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !busy && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Sửa link chia sẻ" : "Tạo link chia sẻ"}</DialogTitle>
          <DialogDescription>
            {targetTitle ? (
              <>
                <span className="font-medium text-foreground">{targetTitle}</span>.{" "}
              </>
            ) : null}
            Khách mở link không cần tài khoản. Giấy tờ pháp lý gốc, thù lao và ghi chú nội bộ không bao giờ hiện.
          </DialogDescription>
        </DialogHeader>

        <form id="posting-share-link" className="space-y-4" onSubmit={submit} noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="sl-label">
              Gửi cho <Req />
            </Label>
            <Input id="sl-label" maxLength={80} placeholder="VD: Anh Minh – KHDN" disabled={busy} {...form.register("label")} />
            <OutcomeFieldError msg={errors.label?.message} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sl-channel">
              Kênh gửi <Req />
            </Label>
            <Controller
              control={form.control}
              name="channel"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange} disabled={busy}>
                  <SelectTrigger id="sl-channel" aria-invalid={!!errors.channel}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MKT_CHANNELS.map((c) => {
                      const Icon = MKT_CHANNEL_META[c].icon;
                      return (
                        <SelectItem key={c} value={c}>
                          <span className="flex items-center gap-2">
                            <Icon className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                            {MKT_CHANNEL_META[c].label}
                          </span>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              )}
            />
            <p className="text-xs text-muted-foreground">Mỗi kênh một link để biết kênh nào mang khách về.</p>
            <OutcomeFieldError msg={errors.channel?.message} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sl-expiry">
              Thời hạn link <Req />
            </Label>
            <Controller
              control={form.control}
              name="expiry"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange} disabled={busy}>
                  <SelectTrigger id="sl-expiry">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {expiryOptions.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Người gửi {showSenderContact && <Req />}</Label>
            <Controller
              control={form.control}
              name="senderUserId"
              render={({ field }) => (
                <ShareSenderCard
                  senders={senders}
                  value={field.value}
                  onChange={field.onChange}
                  currentUserId={userId}
                  loading={sendersQ.isLoading}
                  disabled={busy}
                  invalid={!!errors.senderUserId}
                />
              )}
            />
            {errors.senderUserId ? (
              <OutcomeFieldError msg={errors.senderUserId.message} />
            ) : (
              sendersQ.isError && <OutcomeFieldError msg="Chưa tải được danh sách thành viên. Đóng và mở lại để thử lại." />
            )}
          </div>

          <div className="rounded-xl bg-primary/5 px-3">
            <ToggleRow id="sl-show-contact" label="Hiện liên hệ người gửi" help="Khách thấy tên và nút “Gọi”.">
              <Controller
                control={form.control}
                name="showSenderContact"
                render={({ field }) => (
                  <Switch id="sl-show-contact" checked={field.value} onCheckedChange={field.onChange} disabled={busy} />
                )}
              />
            </ToggleRow>
            {isListing ? (
              <p className="py-3 text-xs text-muted-foreground">
                Giá khởi điểm luôn hiện — tin đã công khai giá trên sàn.
              </p>
            ) : (
              <ToggleRow
                id="sl-show-price"
                label="Hiện giá khởi điểm"
                help="Khi tài sản đã có phiên công bố, giá luôn hiện theo thông báo đấu giá."
              >
                <Controller
                  control={form.control}
                  name="showPrice"
                  render={({ field }) => (
                    <Switch id="sl-show-price" checked={field.value} onCheckedChange={field.onChange} disabled={busy} />
                  )}
                />
              </ToggleRow>
            )}
            <ToggleRow id="sl-show-address" label="Hiện địa chỉ chính xác" help="Tắt: khách chỉ thấy quận / huyện, tỉnh / thành.">
              <Controller
                control={form.control}
                name="showExactAddress"
                render={({ field }) => (
                  <Switch id="sl-show-address" checked={field.value} onCheckedChange={field.onChange} disabled={busy} />
                )}
              />
            </ToggleRow>
          </div>
        </form>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
            Đóng
          </Button>
          <Button type="submit" form="posting-share-link" disabled={busy}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {editing ? "Lưu" : "Tạo & sao chép link"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
