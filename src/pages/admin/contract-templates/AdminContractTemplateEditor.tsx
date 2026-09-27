import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AlertTriangle, ArrowLeft, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useContractTemplate, useCreateContractTemplate } from "@/hooks/useContractTemplates";
import { vnTodayStr } from "@/lib/legalStatus";
import { isTemplateType, templateTypeDef, PLACEHOLDER_MARK, type ClauseMap } from "@/lib/contracts/templates/schema";
import { emptySlots, inputToSlot, resolveClauses, slotToInput } from "@/lib/contracts/templates/resolve";
import { ADMIN_CONTRACT_TEMPLATES_PATH, adminContractTemplatePath } from "@/lib/contracts/paths";

/** "HDMB-MAU" + ngày ⇒ "HDMB-MAU-2026-10-01" — chỉ là gợi ý, admin sửa được. */
const suggestVersion = (prefix: string, today: string) => `${prefix}-${today}`;

/**
 * /admin/mau-hop-dong/tao?type=&from= — tạo phiên bản mới của một loại mẫu. Nhân bản
 * (from) nạp câu chữ bản nguồn; không có nguồn thì lấy mặc định trong hệ thống.
 * Phiên bản bất biến: lưu xong không sửa được, chỉ tạo bản tiếp theo.
 */
export default function AdminContractTemplateEditor() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const create = useCreateContractTemplate();
  const typeParam = params.get("type");
  const def = isTemplateType(typeParam) ? templateTypeDef(typeParam) : null;
  const fromId = params.get("from") ?? undefined;
  const { data: source, isLoading: loadingSource } = useContractTemplate(fromId);

  const today = vnTodayStr();
  const [version, setVersion] = useState(def ? suggestVersion(def.versionPrefix, today) : "");
  const [effectiveDate, setEffectiveDate] = useState(today);
  const [changelog, setChangelog] = useState("");
  const [inputs, setInputs] = useState<Record<string, string> | null>(null);

  // Nạp câu chữ ban đầu MỘT lần: bản nguồn (nhân bản) hoặc mặc định của loại.
  useEffect(() => {
    if (!def || inputs) return;
    if (fromId && loadingSource) return;
    const base = resolveClauses(def.type, source?.template_type === def.type ? source.clauses : def.defaults);
    setInputs(Object.fromEntries(def.slots.map((slot) => [slot.key, slotToInput(slot, base[slot.key])])));
  }, [def, fromId, loadingSource, source, inputs]);

  if (!def) {
    return (
      <div className="px-6 py-8 text-sm text-muted-foreground">
        Loại mẫu không hợp lệ.{" "}
        <button type="button" className="text-primary underline" onClick={() => navigate(ADMIN_CONTRACT_TEMPLATES_PATH)}>
          Về danh sách mẫu
        </button>
      </div>
    );
  }

  if (!inputs) {
    return (
      <div className="space-y-4 px-6 py-8">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const clauses: ClauseMap = Object.fromEntries(def.slots.map((s) => [s.key, inputToSlot(s, inputs[s.key] ?? "")]));
  const empty = emptySlots(def.slots, clauses);
  const withPlaceholder = def.slots.filter((s) => (inputs[s.key] ?? "").includes(PLACEHOLDER_MARK));
  const backdated = effectiveDate < today;

  const handleSave = async () => {
    if (!version.trim()) return toast.error("Vui lòng nhập mã phiên bản");
    if (!effectiveDate || backdated) return toast.error("Ngày hiệu lực không được trước hôm nay");
    if (empty.length) return toast.error(`Còn trống: ${empty.map((s) => s.label).join(", ")}`);
    try {
      const row = await create.mutateAsync({
        template_type: def.type,
        version: version.trim(),
        effective_date: effectiveDate,
        changelog: changelog.trim() || null,
        clauses,
      });
      navigate(adminContractTemplatePath(row.id));
    } catch {
      /* lỗi đã toast trong hook */
    }
  };

  const groups = [
    { key: "party", title: "Thông tin Bên B (sàn)", slots: def.slots.filter((s) => s.group === "party") },
    { key: "clause", title: "Điều khoản", slots: def.slots.filter((s) => s.group === "clause") },
  ].filter((g) => g.slots.length > 0);

  return (
    <div className="space-y-6 px-6 py-8">
      <div className="flex items-center gap-3">
        <Button type="button" variant="ghost" size="sm" className="-ml-2" onClick={() => navigate(`${ADMIN_CONTRACT_TEMPLATES_PATH}?loai=${def.type}`)}>
          <ArrowLeft className="mr-1 h-4 w-4" aria-hidden />
          Mẫu hợp đồng
        </Button>
      </div>
      <div>
        <h1 className="text-xl font-bold text-foreground">{fromId ? "Nhân bản phiên bản" : "Tạo phiên bản mới"}</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {def.label}
          {source ? ` · từ ${source.version}` : ""}
        </p>
      </div>

      <div className="grid gap-4 rounded-xl border border-border bg-card p-5 md:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="tpl-version">Mã phiên bản</Label>
          <Input id="tpl-version" value={version} onChange={(e) => setVersion(e.target.value)} maxLength={60} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tpl-effective">Ngày hiệu lực</Label>
          <Input id="tpl-effective" type="date" min={today} value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} />
          <p className="text-xs text-muted-foreground">
            {effectiveDate <= today
              ? "Áp dụng ngay cho hợp đồng lập từ hôm nay."
              : "Chờ áp dụng tới ngày hiệu lực; trước đó vẫn dùng bản hiện hành."}
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tpl-changelog">Ghi chú thay đổi</Label>
          <Input id="tpl-changelog" value={changelog} onChange={(e) => setChangelog(e.target.value)} placeholder="VD: Rà soát pháp lý lần 1" />
        </div>
      </div>

      {withPlaceholder.length > 0 && (
        <p className="flex items-start gap-2 rounded-lg bg-warning/10 px-3 py-2 text-sm text-warning">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.5} aria-hidden />
          Còn "{PLACEHOLDER_MARK}" ở: {withPlaceholder.map((s) => s.label).join(", ")}.
        </p>
      )}

      {groups.map((g) => (
        <section key={g.key} className="space-y-4 rounded-xl border border-border bg-card p-5">
          <h2 className="text-base font-semibold">{g.title}</h2>
          {g.slots.map((slot) => (
            <div key={slot.key} className="space-y-1.5">
              <Label htmlFor={`slot-${slot.key}`}>{slot.label}</Label>
              {slot.kind === "text" && slot.group === "party" ? (
                <Input
                  id={`slot-${slot.key}`}
                  value={inputs[slot.key] ?? ""}
                  onChange={(e) => setInputs({ ...inputs, [slot.key]: e.target.value })}
                />
              ) : (
                <Textarea
                  id={`slot-${slot.key}`}
                  rows={slot.kind === "list" ? 5 : 3}
                  value={inputs[slot.key] ?? ""}
                  onChange={(e) => setInputs({ ...inputs, [slot.key]: e.target.value })}
                />
              )}
              <p className="text-xs text-muted-foreground">
                {slot.kind === "list" ? "Mỗi dòng một mục." : null}
                {slot.hint ? ` ${slot.hint}` : null}
              </p>
            </div>
          ))}
        </section>
      ))}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => navigate(-1)}>
          Huỷ
        </Button>
        <Button type="button" onClick={handleSave} disabled={create.isPending || backdated}>
          <Save className="mr-1.5 h-4 w-4" aria-hidden />
          Lưu phiên bản
        </Button>
      </div>
    </div>
  );
}
