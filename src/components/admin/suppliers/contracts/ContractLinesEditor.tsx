import { useMemo, useState } from "react";
import { Plus, Trash2, Pencil, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { groupNumber, parseNumber } from "@/lib/advertising/slug";
import { commissionLabel } from "@/lib/supplierContracts";
import { useServices } from "@/hooks/useServices";
import { useServiceVariants } from "@/hooks/useServiceVariants";
import {
  contractErrorMessage,
  useDeleteContractLine,
  useUpsertContractLine,
} from "@/hooks/useSupplierContracts";
import type { CommissionType } from "@/types/orders";
import type { SupplierContract, SupplierContractLine } from "@/types/supplierContract";

const ALL_VARIANTS = "__all__";

interface Props {
  contract: SupplierContract;
  supplierId: string;
  canEdit: boolean;
}

interface Draft {
  id?: string;
  service_id: string;
  service_variant_id: string;
  commission_type: CommissionType;
  commission_value: number;
  note: string;
}

const EMPTY_DRAFT: Draft = {
  service_id: "",
  service_variant_id: ALL_VARIANTS,
  commission_type: "percent",
  commission_value: 0,
  note: "",
};

/**
 * Bảng dòng dịch vụ của một hợp đồng — mỗi dòng là MỘT hợp tác.
 *
 * Chỉ chào dịch vụ `kind='commission'` mà đối tác này dùng được: dịch vụ riêng
 * của họ (`supplier_id` khớp) hoặc dịch vụ dùng chung (`supplier_scope='per_order'`,
 * ví dụ môi giới ký gửi). Dịch vụ credit/direct không có chỗ ở đây vì dòng hợp
 * đồng mang MỨC HOA HỒNG — khái niệm chỉ tồn tại với dịch vụ commission.
 */
export function ContractLinesEditor({ contract, supplierId, canEdit }: Props) {
  const { data: services } = useServices();
  const { data: variants } = useServiceVariants();
  const upsert = useUpsertContractLine();
  const del = useDeleteContractLine();

  const [draft, setDraft] = useState<Draft | null>(null);

  const eligibleServices = useMemo(
    () =>
      (services ?? []).filter(
        (s) =>
          s.kind === "commission" &&
          s.is_active &&
          (s.supplier_scope === "per_order" || s.supplier_id === supplierId),
      ),
    [services, supplierId],
  );

  const variantsOfService = useMemo(
    () => (variants ?? []).filter((v) => v.service_id === draft?.service_id && v.is_active),
    [variants, draft?.service_id],
  );

  const lines = contract.lines ?? [];
  const isPercent = draft?.commission_type === "percent";

  const startAdd = () => setDraft({ ...EMPTY_DRAFT });
  const startEdit = (l: SupplierContractLine) =>
    setDraft({
      id: l.id,
      service_id: l.service_id,
      service_variant_id: l.service_variant_id ?? ALL_VARIANTS,
      commission_type: l.commission_type,
      commission_value: Number(l.commission_value),
      note: l.note ?? "",
    });

  const save = async () => {
    if (!draft) return;
    if (!draft.service_id) return toast.error("Vui lòng chọn dịch vụ");
    if (draft.commission_value <= 0) return toast.error("Vui lòng nhập mức hoa hồng");
    if (draft.commission_type === "percent" && draft.commission_value > 100)
      return toast.error("Tỷ lệ hoa hồng không vượt quá 100%");

    try {
      await upsert.mutateAsync({
        supplierId,
        line: {
          ...(draft.id ? { id: draft.id } : {}),
          contract_id: contract.id,
          service_id: draft.service_id,
          service_variant_id:
            draft.service_variant_id === ALL_VARIANTS ? null : draft.service_variant_id,
          commission_type: draft.commission_type,
          commission_value: draft.commission_value,
          note: draft.note.trim() || null,
        },
      });
      toast.success(draft.id ? "Đã cập nhật dịch vụ" : "Đã thêm dịch vụ vào hợp đồng");
      setDraft(null);
    } catch (err) {
      toast.error(contractErrorMessage(err, "Lưu thất bại"));
    }
  };

  const remove = async (line: SupplierContractLine) => {
    try {
      await del.mutateAsync({ id: line.id, supplierId });
      toast.success("Đã xoá dịch vụ khỏi hợp đồng");
    } catch (err) {
      toast.error(contractErrorMessage(err, "Xoá thất bại"));
    }
  };

  return (
    <div className="rounded-xl border border-border">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
        <p className="text-sm font-medium text-foreground">
          Dịch vụ hợp tác{" "}
          <span className="text-muted-foreground font-normal">({lines.length})</span>
        </p>
        {canEdit && !draft && (
          <Button size="sm" variant="outline" className="h-7" onClick={startAdd}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            Thêm dịch vụ
          </Button>
        )}
      </div>

      {lines.length === 0 && !draft && (
        <p className="px-4 py-6 text-sm text-muted-foreground text-center">
          Chưa có dịch vụ nào. Hợp đồng không có dòng dịch vụ sẽ không sinh ra mức hoa hồng nào.
        </p>
      )}

      {lines.length > 0 && (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-muted-foreground border-b border-border">
              <th className="px-4 py-2 text-left font-medium">Dịch vụ</th>
              <th className="px-4 py-2 text-left font-medium">Biến thể</th>
              <th className="px-4 py-2 text-right font-medium">Hoa hồng</th>
              <th className="px-4 py-2 text-left font-medium">Ghi chú</th>
              {canEdit && <th className="px-4 py-2 w-20" />}
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.id} className="border-b border-border last:border-0">
                <td className="px-4 py-2.5">{l.service?.name ?? "—"}</td>
                <td className="px-4 py-2.5 text-muted-foreground">
                  {l.variant?.name ?? "Mọi biến thể"}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums font-medium">
                  {commissionLabel(l.commission_type, l.commission_value, groupNumber)}
                </td>
                <td className="px-4 py-2.5 text-muted-foreground">{l.note ?? "—"}</td>
                {canEdit && (
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1 justify-end">
                      <Button
                        size="icon" variant="ghost" className="h-7 w-7"
                        onClick={() => startEdit(l)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon" variant="ghost" className="h-7 w-7 text-destructive"
                        onClick={() => remove(l)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {draft && (
        <div className="border-t border-border bg-muted/40 p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Dịch vụ *</Label>
              <Select
                value={draft.service_id}
                onValueChange={(v) =>
                  setDraft((d) =>
                    d ? { ...d, service_id: v, service_variant_id: ALL_VARIANTS } : d,
                  )
                }
              >
                <SelectTrigger><SelectValue placeholder="Chọn dịch vụ hoa hồng" /></SelectTrigger>
                <SelectContent>
                  {eligibleServices.length === 0 && (
                    <div className="px-2 py-3 text-xs text-muted-foreground">
                      Chưa có dịch vụ hoa hồng nào dùng được cho đối tác này
                    </div>
                  )}
                  {eligibleServices.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">Biến thể</Label>
              <Select
                value={draft.service_variant_id}
                onValueChange={(v) =>
                  setDraft((d) => (d ? { ...d, service_variant_id: v } : d))
                }
                disabled={!draft.service_id}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_VARIANTS}>Mọi biến thể</SelectItem>
                  {variantsOfService.map((v) => (
                    <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">Cách tính</Label>
              <Select
                value={draft.commission_type}
                onValueChange={(v) =>
                  // Đổi cách tính phải XOÁ giá trị: percent 15 → fixed 15 thành 15₫
                  // mà mọi ràng buộc đều lọt.
                  setDraft((d) =>
                    d ? { ...d, commission_type: v as CommissionType, commission_value: 0 } : d,
                  )
                }
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="percent">Phần trăm (%)</SelectItem>
                  <SelectItem value="fixed">Số tiền cố định</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">{isPercent ? "Tỷ lệ (%)" : "Số tiền (VND)"}</Label>
              {isPercent ? (
                // parseNumber strip mọi ký tự không phải chữ số ⇒ 12.5 thành 125.
                <Input
                  type="number" step="0.01" min="0" max="100"
                  value={draft.commission_value || ""}
                  onChange={(e) =>
                    setDraft((d) => (d ? { ...d, commission_value: Number(e.target.value) } : d))
                  }
                  placeholder="5"
                />
              ) : (
                <Input
                  inputMode="numeric"
                  value={groupNumber(draft.commission_value)}
                  onChange={(e) =>
                    setDraft((d) =>
                      d ? { ...d, commission_value: parseNumber(e.target.value) } : d,
                    )
                  }
                  placeholder="20,000,000"
                />
              )}
            </div>

            <div className="md:col-span-2">
              <Label className="text-xs">Ghi chú</Label>
              <Input
                value={draft.note}
                onChange={(e) => setDraft((d) => (d ? { ...d, note: e.target.value } : d))}
                placeholder="Áp dụng cho tài sản bất động sản"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setDraft(null)}>
              <X className="h-3.5 w-3.5 mr-1" />
              Hủy
            </Button>
            <Button size="sm" onClick={save} disabled={upsert.isPending}>
              <Check className="h-3.5 w-3.5 mr-1" />
              {upsert.isPending ? "Đang lưu…" : "Lưu dòng"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
