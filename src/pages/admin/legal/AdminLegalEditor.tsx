import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Save, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { RichTextEditor } from "@/components/admin/RichTextEditor";
import { useCreateLegalVersion, useLegalVersion } from "@/hooks/useLegalDocuments";
import { LEGAL_DOC_LABELS, type LegalDocType } from "@/types/legal";

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function AdminLegalEditor() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const create = useCreateLegalVersion();

  const typeParam = params.get("type");
  const docType: LegalDocType = typeParam === "privacy" ? "privacy" : "terms";
  const cloneFrom = params.get("from") ?? undefined;

  const { data: source, isLoading: loadingSource } = useLegalVersion(cloneFrom);

  const [version, setVersion] = useState(todayStr());
  const [effectiveDate, setEffectiveDate] = useState(todayStr());
  const [changelog, setChangelog] = useState("");
  const [content, setContent] = useState("");
  const [prefilled, setPrefilled] = useState(false);

  // Nhân bản: nạp nội dung nguồn (giữ metadata mới — phiên bản/ngày mặc định hôm nay).
  useEffect(() => {
    if (!cloneFrom || !source || prefilled) return;
    setContent(source.content ?? "");
    setPrefilled(true);
  }, [cloneFrom, source, prefilled]);

  const willBeActive = effectiveDate <= todayStr();
  const loading = !!cloneFrom && loadingSource && !prefilled;

  const handleSave = async () => {
    const v = version.trim();
    if (!v) return toast.error("Vui lòng nhập nhãn phiên bản");
    if (!effectiveDate) return toast.error("Vui lòng chọn ngày hiệu lực");
    try {
      const row = await create.mutateAsync({
        doc_type: docType,
        version: v,
        effective_date: effectiveDate,
        changelog: changelog.trim() || null,
        content: content.trim() || null,
      });
      navigate(`/admin/phap-ly/${row.id}`);
    } catch {
      /* lỗi đã toast trong hook */
    }
  };

  const title = useMemo(
    () => (cloneFrom ? "Nhân bản phiên bản" : "Tạo phiên bản mới"),
    [cloneFrom],
  );

  if (loading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/admin/phap-ly")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-semibold text-foreground">{title}</h1>
          <p className="text-sm text-muted-foreground">{LEGAL_DOC_LABELS[docType]}</p>
        </div>
        <Button size="sm" disabled={create.isPending} onClick={handleSave}>
          <Save className="mr-1.5 h-4 w-4" />
          Lưu phiên bản
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Nội dung — trái 2/3 */}
        <div className="xl:col-span-2">
          <div className="space-y-1.5 rounded-xl border border-border bg-card p-5">
            <Label>Nội dung văn bản</Label>
            <RichTextEditor
              value={content}
              onChange={setContent}
              placeholder="Soạn nội dung Điều khoản / Chính sách…"
            />
          </div>
        </div>

        {/* Metadata — phải 1/3 */}
        <div className="space-y-4">
          <div className="space-y-4 rounded-xl border border-border bg-card p-4">
            <h3 className="text-sm font-semibold text-foreground">Thông tin phiên bản</h3>
            <div className="space-y-1.5">
              <Label>
                Nhãn phiên bản <span className="text-destructive">*</span>
              </Label>
              <Input
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                placeholder="VD: 2026-08-01 hoặc 1.2"
              />
              <p className="text-xs text-muted-foreground">Không trùng với phiên bản đã có của loại này.</p>
            </div>
            <div className="space-y-1.5">
              <Label>
                Ngày hiệu lực <span className="text-destructive">*</span>
              </Label>
              <Input
                type="date"
                value={effectiveDate}
                onChange={(e) => setEffectiveDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Ghi chú thay đổi</Label>
              <Textarea
                value={changelog}
                onChange={(e) => setChangelog(e.target.value)}
                rows={3}
                placeholder="Tóm tắt điểm thay đổi so với phiên bản trước…"
              />
            </div>
          </div>

          <div className="flex items-start gap-2 rounded-xl border border-warning/40 bg-warning/10 p-3 text-sm text-foreground">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            {willBeActive ? (
              <span>
                Ngày hiệu lực ≤ hôm nay: phiên bản áp dụng ngay và{" "}
                <strong>buộc người dùng đã đồng ý phiên bản cũ đăng nhập lại</strong> để đồng ý.
              </span>
            ) : (
              <span>
                Ngày hiệu lực tương lai: phiên bản ở trạng thái <strong>Chờ áp dụng</strong>, chưa
                gây đăng xuất cho tới ngày hiệu lực.
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
