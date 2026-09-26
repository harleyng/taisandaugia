import { useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/** Chọn đối tác có hợp đồng hiệu lực + tên chuyên gia phụ trách (dịch vụ tư vấn). */
export function ExpertAssignmentFields({
  partners,
  isLoading,
  supplierId,
  expertName,
  expertPlaceholder,
  onChange,
}: {
  partners: { supplier_id: string; name: string }[];
  isLoading: boolean;
  supplierId: string;
  expertName: string;
  expertPlaceholder: string;
  onChange: (next: { supplierId: string; expertName: string }) => void;
}) {
  // Chỉ một đối tác đủ điều kiện ⇒ chọn sẵn.
  useEffect(() => {
    if (!supplierId && partners.length === 1) onChange({ supplierId: partners[0].supplier_id, expertName });
  }, [partners, supplierId, expertName, onChange]);

  return (
    <>
      <div className="space-y-1.5">
        <Label htmlFor="expert-partner">Đối tác tư vấn</Label>
        <Select value={supplierId} onValueChange={(v) => onChange({ supplierId: v, expertName })} disabled={isLoading}>
          <SelectTrigger id="expert-partner">
            <SelectValue placeholder={isLoading ? "Đang tải…" : "Chọn đối tác có hợp đồng hiệu lực"} />
          </SelectTrigger>
          <SelectContent>
            {partners.map((p) => (
              <SelectItem key={p.supplier_id} value={p.supplier_id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {!isLoading && partners.length === 0 && (
          <p className="text-xs text-destructive">Chưa có đối tác nào có hợp đồng hiệu lực cho dịch vụ này.</p>
        )}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="expert-name">Chuyên gia được phân công</Label>
        <Input
          id="expert-name"
          value={expertName}
          maxLength={200}
          placeholder={expertPlaceholder}
          onChange={(e) => onChange({ supplierId, expertName: e.target.value })}
        />
      </div>
    </>
  );
}
