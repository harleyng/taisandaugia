import { Card } from "@/components/ui/card";
import { formatPrice } from "@/utils/formatters";

interface Fee {
  name: string;
  amount: number;
  unit?: string;
}

interface FeesTableProps {
  fees?: Fee[];
  serviceCosts?: number;
  className?: string;
}

export const FeesTable = ({ fees = [], serviceCosts, className = "" }: FeesTableProps) => {
  const hasFees = (fees && fees.length > 0) || serviceCosts;

  if (!hasFees) {
    return <p className="text-muted-foreground">Chưa có thông tin chi phí</p>;
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {serviceCosts && (
        <div className="flex justify-between py-3 border-b">
          <span className="text-foreground font-medium">Phí dịch vụ</span>
          <span className="font-semibold text-primary">
            {formatPrice(serviceCosts, "TOTAL")}/tháng
          </span>
        </div>
      )}
      
      {fees && fees.map((fee, index) => (
        <div key={index} className="flex justify-between py-3 border-b">
          <span className="text-foreground font-medium">{fee.name}</span>
          <span className="font-semibold text-primary">
            {formatPrice(fee.amount, "TOTAL")}
            {fee.unit && ` ${fee.unit}`}
          </span>
        </div>
      ))}
    </div>
  );
};
