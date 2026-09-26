import { useState } from "react";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { Loader2, Trash2, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useHasAdminPermission } from "@/hooks/useAdminPermissions";
import {
  useSellerAuthenticationRestrictions,
  useSetSellerAuthenticationRestriction,
} from "@/hooks/useAdminAuthenticationOrders";

/** Người bán bị hạn chế (BR-GD-03): mọi lô của họ phải có chứng thư "xác thực" trước khi nộp. */
export function SellerRestrictionsCard() {
  const canEdit = useHasAdminPermission("tai-san-tu-nguyen", "approve");
  const { data: rows = [], isLoading } = useSellerAuthenticationRestrictions();
  const setRestriction = useSetSellerAuthenticationRestriction();
  const [email, setEmail] = useState("");
  const [reason, setReason] = useState("");

  const add = () =>
    setRestriction.mutate(
      { email: email.trim(), restricted: true, reason: reason.trim() },
      {
        onSuccess: () => {
          setEmail("");
          setReason("");
        },
      },
    );

  return (
    <div className="space-y-4">
      {canEdit && (
        <div className="grid gap-3 sm:grid-cols-[1fr_1.4fr_auto] sm:items-end">
          <div className="space-y-1.5">
            <Label htmlFor="gd-seller-email">Email người bán</Label>
            <Input id="gd-seller-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="gd-seller-reason">Lý do</Label>
            <Input
              id="gd-seller-reason"
              value={reason}
              maxLength={500}
              placeholder="VD: Từng đăng lô có kết luận nghi giả"
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          <Button
            size="sm"
            disabled={!email.includes("@") || reason.trim().length < 5 || setRestriction.isPending}
            onClick={add}
          >
            <UserX className="mr-1.5 h-3.5 w-3.5" /> Thêm
          </Button>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Đang tải…
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Chưa có người bán nào thuộc diện bắt buộc giám định.</p>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {rows.map((r) => (
            <li key={r.user_id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">
                  {r.name || r.email} <span className="font-normal text-muted-foreground">· {r.email}</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {r.reason} · từ {format(new Date(r.created_at), "dd/MM/yyyy", { locale: vi })}
                </p>
              </div>
              {canEdit && (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={setRestriction.isPending}
                  onClick={() => setRestriction.mutate({ email: r.email, restricted: false, reason: "" })}
                >
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Gỡ
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
