import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Users, ParkingSquare, Lightbulb, DollarSign, MoreVertical } from "lucide-react";
import { AddFeeDialog } from "./AddFeeDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const paymentFrequencyLabels: Record<string, string> = {
  monthly: "Hàng tháng",
  quarterly: "Hàng quý",
  yearly: "Hàng năm",
  "one-time": "Một lần"
};

interface Fee {
  id: string;
  category: string;
  feeName: string;
  paymentFrequency: string;
  isRefundable?: boolean;
  feeType: string;
  amount: number;
  maxAmount?: number;
}

interface ListingFormStep6CostsAndFeesProps {
  fees: Fee[];
  setFees: (fees: Fee[]) => void;
}

export const ListingFormStep6CostsAndFees = ({
  fees,
  setFees
}: ListingFormStep6CostsAndFeesProps) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [editingFee, setEditingFee] = useState<Fee | null>(null);

  const categories = [{
    id: "administrative",
    name: "Phí hành chính",
    icon: Users
  }, {
    id: "parking",
    name: "Phí đỗ xe",
    icon: ParkingSquare
  }, {
    id: "utilities",
    name: "Phí tiện ích",
    icon: Lightbulb
  }, {
    id: "other",
    name: "Các danh mục khác",
    icon: DollarSign
  }];

  const handleAddFee = (category: string) => {
    setSelectedCategory(category);
    setIsDialogOpen(true);
  };

  const handleSaveFee = (fee: Omit<Fee, "id">) => {
    if (editingFee) {
      // Update existing fee
      setFees(fees.map(f => f.id === editingFee.id ? { ...fee, id: editingFee.id } : f));
    } else {
      // Add new fee
      const newFee: Fee = {
        ...fee,
        id: Date.now().toString()
      };
      setFees([...fees, newFee]);
    }
    setIsDialogOpen(false);
    setSelectedCategory(null);
    setEditingFee(null);
  };

  const handleEditFee = (fee: Fee) => {
    setEditingFee(fee);
    setSelectedCategory(fee.category);
    setIsDialogOpen(true);
  };

  const handleDeleteFee = (feeId: string) => {
    setFees(fees.filter(f => f.id !== feeId));
  };

  const getCategoryFees = (categoryId: string) => {
    return fees.filter(f => f.category === categoryId);
  };

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-3xl font-semibold mb-2">Bạn có thu thêm chi phí nào không?</h2>
        <p className="text-muted-foreground text-lg">Chúng tôi đã làm nổi bật các loại phí phổ biến nhất. </p>
      </div>

      <div className="space-y-4">
        {categories.map(category => {
          const Icon = category.icon;
          const categoryFees = getCategoryFees(category.id);
          return (
            <div key={category.id} className="border rounded-lg overflow-hidden">
              <div 
                className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors cursor-pointer"
                onClick={() => handleAddFee(category.id)}
              >
                <div className="flex items-center gap-3">
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{category.name}</span>
                </div>
                <span className="text-foreground underline font-semibold">
                  Thêm
                </span>
              </div>

              {categoryFees.length > 0 && (
                <div className="border-t">
                  {categoryFees.map((fee, index) => (
                    <div key={fee.id} className={`flex items-center justify-between p-4 ${index !== categoryFees.length - 1 ? 'border-b' : ''}`}>
                      <div className="flex-1">
                        <div className="font-medium mb-1">{fee.feeName}</div>
                        <div className="text-sm text-muted-foreground flex flex-wrap items-center gap-1">
                          <span>
                            {fee.feeType === "usage-based" ? "Dựa trên mức độ sử dụng" : fee.feeType === "range" && fee.maxAmount ? (
                              <>
                                {new Intl.NumberFormat("vi-VN", {
                                  style: "currency",
                                  currency: "VND"
                                }).format(fee.amount)}{" "}
                                -{" "}
                                {new Intl.NumberFormat("vi-VN", {
                                  style: "currency",
                                  currency: "VND"
                                }).format(fee.maxAmount)}
                              </>
                            ) : new Intl.NumberFormat("vi-VN", {
                              style: "currency",
                              currency: "VND"
                            }).format(fee.amount)}
                          </span>
                          <span>-</span>
                          <span>{paymentFrequencyLabels[fee.paymentFrequency] || fee.paymentFrequency}</span>
                          {fee.isRefundable !== undefined && (
                            <>
                              <span>-</span>
                              <span>
                                {fee.isRefundable ? "Có hoàn lại" : "Không hoàn lại"}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 ml-2">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-background">
                          <DropdownMenuItem onClick={() => handleEditFee(fee)}>
                            Chỉnh sửa
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDeleteFee(fee.id)} className="text-destructive">
                            Xóa
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <AddFeeDialog 
        isOpen={isDialogOpen} 
        onClose={() => {
          setIsDialogOpen(false);
          setSelectedCategory(null);
          setEditingFee(null);
        }} 
        onSave={handleSaveFee} 
        category={selectedCategory} 
        editingFee={editingFee} 
      />
    </div>
  );
};
