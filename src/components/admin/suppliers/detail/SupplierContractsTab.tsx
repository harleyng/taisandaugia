import { useState } from "react";
import { Loader2, Plus, FileSignature } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSupplierContracts } from "@/hooks/useSupplierContracts";
import { ContractCard } from "@/components/admin/suppliers/contracts/ContractCard";
import { ContractFormDialog } from "@/components/admin/suppliers/contracts/ContractFormDialog";
import type { SupplierContract } from "@/types/supplierContract";

interface Props {
  supplierId: string;
  canEdit: boolean;
  canDelete: boolean;
}

export function SupplierContractsTab({ supplierId, canEdit, canDelete }: Props) {
  const { data: contracts, isLoading } = useSupplierContracts(supplierId);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<SupplierContract | null>(null);

  const openAdd = () => { setEditing(null); setDialogOpen(true); };
  const openEdit = (c: SupplierContract) => { setEditing(c); setDialogOpen(true); };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const list = contracts ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {list.length} hợp đồng đã ký với đối tác này
        </p>
        {canEdit && (
          <Button size="sm" onClick={openAdd}>
            <Plus className="h-4 w-4 mr-1.5" />
            Thêm hợp đồng
          </Button>
        )}
      </div>

      {list.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border py-16 text-center">
          <FileSignature className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground mb-1">Chưa có hợp đồng nào</p>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Hợp đồng được ký ngoài nền tảng, sau đó ghi lại ở đây. Chưa có hợp đồng đang hiệu
            lực thì mức hoa hồng sẽ phải nhập tay trên từng đơn.
          </p>
        </div>
      ) : (
        list.map((c) => (
          <ContractCard
            key={c.id}
            contract={c}
            supplierId={supplierId}
            canEdit={canEdit}
            canDelete={canDelete}
            onEdit={openEdit}
          />
        ))
      )}

      <ContractFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        supplierId={supplierId}
      />
    </div>
  );
}
