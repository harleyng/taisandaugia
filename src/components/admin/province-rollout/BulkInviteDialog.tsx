import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Copy, Download, Loader2, Upload, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  INVITE_CSV_TEMPLATE,
  INVITE_ROLE_LABELS,
  parseInviteCsv,
  type InviteRole,
} from "@/lib/provinceRollout/csv";
import { inviteUrl } from "@/lib/provinceRollout/links";
import {
  BULK_INVITE_STATUS_LABELS,
  useBulkInvite,
  type BulkInviteResultRow,
} from "@/hooks/useProvinceRollout";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  workspaceName: string;
}

/**
 * Mời cán bộ xã theo lô từ CSV `email, mã đơn vị, vai trò`. KHÔNG gửi email —
 * trả danh sách link để sàn copy, đúng cơ chế lời mời đang có của Trạm.
 */
export function BulkInviteDialog({ open, onOpenChange, workspaceId, workspaceName }: Props) {
  const [text, setText] = useState("");
  const [result, setResult] = useState<BulkInviteResultRow[] | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const bulk = useBulkInvite();

  const parsed = useMemo(() => parseInviteCsv(text), [text]);

  const pickFile = async (file: File | undefined) => {
    if (!file) return;
    setText(await file.text());
    setResult(null);
  };

  const downloadTemplate = () => {
    const blob = new Blob([`\ufeff${INVITE_CSV_TEMPLATE}\n`], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "mau-moi-can-bo-xa.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const copyAll = async () => {
    const lines = (result ?? [])
      .filter((r) => r.token)
      .map((r) => `${r.email}\t${r.unit_name ?? r.admin_unit_code}\t${inviteUrl(r.token!)}`);
    if (lines.length === 0) return;
    await navigator.clipboard.writeText(lines.join("\n"));
    toast.success(`Đã copy ${lines.length} link lời mời.`);
  };

  const submit = async () => {
    if (parsed.rows.length === 0) {
      toast.error("Chưa có dòng nào hợp lệ.");
      return;
    }
    try {
      const res = await bulk.mutateAsync({ workspaceId, rows: parsed.rows });
      setResult(res.rows);
      toast.success(`Tạo mới ${res.created}, đã có ${res.existing}, lỗi ${res.failed}.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không mời được.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" strokeWidth={1.5} />
            Mời cán bộ xã theo lô
          </DialogTitle>
          <DialogDescription>
            {workspaceName} — mỗi dòng là <code>email, mã đơn vị, vai trò</code>. Người được mời chỉ
            thấy dữ liệu của xã mình. Sàn không gửi email: copy link rồi chuyển cho đơn vị.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
              <Upload className="mr-2 h-4 w-4" />
              Chọn tệp CSV
            </Button>
            <Button variant="ghost" size="sm" onClick={downloadTemplate}>
              <Download className="mr-2 h-4 w-4" />
              Tải mẫu CSV
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv,text/plain"
              className="hidden"
              onChange={(e) => pickFile(e.target.files?.[0])}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="invite-csv">
              Nội dung CSV <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="invite-csv"
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setResult(null);
              }}
              rows={6}
              className="font-mono text-xs"
              placeholder={INVITE_CSV_TEMPLATE}
            />
            <p className="text-sm text-muted-foreground">
              Đọc được <span className="font-semibold text-foreground">{parsed.rows.length}</span>{" "}
              dòng
              {parsed.errors.length > 0 && (
                <>
                  {" · "}
                  <span className="text-destructive">{parsed.errors.length} dòng lỗi</span>
                </>
              )}
              . Vai trò: {Object.entries(INVITE_ROLE_LABELS)
                .map(([k, v]) => `${k} = ${v}`)
                .join(" · ")}
              .
            </p>
          </div>

          {parsed.errors.length > 0 && (
            <ul className="max-h-28 space-y-1 overflow-y-auto rounded-2xl bg-destructive/10 p-3 text-xs">
              {parsed.errors.map((e) => (
                <li key={e.line}>
                  Dòng {e.line}: {e.reason} — <span className="font-mono">{e.text}</span>
                </li>
              ))}
            </ul>
          )}

          {result && (
            <div className="max-h-60 overflow-y-auto rounded-2xl border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Email</th>
                    <th className="px-3 py-2 text-left font-medium">Đơn vị</th>
                    <th className="px-3 py-2 text-left font-medium">Vai trò</th>
                    <th className="px-3 py-2 text-left font-medium">Kết quả</th>
                    <th className="px-3 py-2 text-left font-medium">Link</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {result.map((r, i) => (
                    <tr key={`${r.email}-${r.admin_unit_code}-${i}`}>
                      <td className="px-3 py-2">{r.email}</td>
                      <td className="px-3 py-2">{r.unit_name ?? r.admin_unit_code}</td>
                      <td className="px-3 py-2">
                        {r.role ? INVITE_ROLE_LABELS[r.role as InviteRole] ?? r.role : "—"}
                      </td>
                      <td className="px-3 py-2">{BULK_INVITE_STATUS_LABELS[r.status] ?? r.status}</td>
                      <td className="px-3 py-2">
                        {r.token ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={async () => {
                              await navigator.clipboard.writeText(inviteUrl(r.token!));
                              toast.success("Đã copy link lời mời.");
                            }}
                          >
                            <Copy className="mr-1.5 h-3.5 w-3.5" />
                            Copy
                          </Button>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <DialogFooter>
          {result && (
            <Button variant="outline" onClick={copyAll}>
              <Copy className="mr-2 h-4 w-4" />
              Copy tất cả link
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Đóng
          </Button>
          <Button onClick={submit} disabled={bulk.isPending || parsed.rows.length === 0}>
            {bulk.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Tạo lời mời
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
