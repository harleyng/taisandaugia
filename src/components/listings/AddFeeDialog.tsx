import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { NumberInput } from "@/components/ui/number-input";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
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
interface AddFeeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (fee: {
    category: string;
    feeName: string;
    paymentFrequency: string;
    isRefundable?: boolean;
    feeType: string;
    amount: number;
    maxAmount?: number;
  }) => void;
  category: string | null;
  editingFee?: Fee | null;
}
const categoryNames: Record<string, string> = {
  administrative: "phí hành chính",
  parking: "phí đỗ xe",
  utilities: "phí tiện ích",
  other: "phí"
};
const feeNamesByCategory: Record<string, string[]> = {
  administrative: ["Phí quản lý", "Phí dịch vụ", "Phí bảo trì", "Phí vệ sinh"],
  parking: ["Chỗ đỗ xe trong nhà", "Chỗ đỗ xe ngoài trời", "Chỗ đỗ xe có mái che", "Chỗ đỗ xe cho khách"],
  utilities: ["Điện", "Nước", "Gas", "Internet", "Truyền hình cáp", "Phí rác"],
  other: ["Phí thú cưng", "Phí lưu trữ", "Phí sân thượng", "Phí phòng tập"]
};
const paymentFrequencies = [{
  value: "monthly",
  label: "Hàng tháng"
}, {
  value: "quarterly",
  label: "Hàng quý"
}, {
  value: "yearly",
  label: "Hàng năm"
}, {
  value: "one-time",
  label: "Một lần"
}];

const feeTypes = [{
  value: "flat",
  label: "Phí cố định"
}, {
  value: "range",
  label: "Khoảng phí"
}, {
  value: "usage-based",
  label: "Dựa trên mức độ sử dụng"
}];
export const AddFeeDialog = ({
  isOpen,
  onClose,
  onSave,
  category,
  editingFee
}: AddFeeDialogProps) => {
  const [feeName, setFeeName] = useState("");
  const [paymentFrequency, setPaymentFrequency] = useState("");
  const [isRefundable, setIsRefundable] = useState(false);
  const [feeType, setFeeType] = useState("");
  const [amount, setAmount] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  useEffect(() => {
    if (!isOpen) {
      // Reset form
      setFeeName("");
      setPaymentFrequency("");
      setIsRefundable(false);
      setFeeType("");
      setAmount("");
      setMinAmount("");
      setMaxAmount("");
    } else if (editingFee) {
      // Populate form with editing fee data
      setFeeName(editingFee.feeName);
      setPaymentFrequency(editingFee.paymentFrequency);
      setIsRefundable(editingFee.isRefundable || false);
      setFeeType(editingFee.feeType);
      if (editingFee.feeType === "range") {
        setMinAmount(editingFee.amount.toString());
        setMaxAmount(editingFee.maxAmount?.toString() || "");
      } else {
        setAmount(editingFee.amount.toString());
      }
    }
  }, [isOpen, editingFee]);
  const handleSave = () => {
    if (!category || !feeName || !paymentFrequency || !feeType) {
      return;
    }

    // Validation for fee range
    if (feeType === "range" && (!minAmount || !maxAmount)) {
      return;
    }

    // Validation for other fee types (except usage-based)
    if (feeType !== "range" && feeType !== "usage-based" && !amount) {
      return;
    }
    onSave({
      category,
      feeName,
      paymentFrequency,
      isRefundable: isRefundable || undefined,
      feeType,
      amount: feeType === "usage-based" ? 0 : (feeType === "range" ? parseFloat(minAmount) : parseFloat(amount)),
      maxAmount: feeType === "range" ? parseFloat(maxAmount) : undefined
    });
  };
  const canSave = feeName && paymentFrequency && feeType && (feeType === "usage-based" ? true : (feeType === "range" ? minAmount && maxAmount : amount));
  const dialogTitle = editingFee ? `Chỉnh sửa ${categoryNames[editingFee.category] || "phí"}` : category ? `Thêm ${categoryNames[category] || "phí"}` : "Thêm phí";
  return <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl">{dialogTitle}</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">Cho người thuê biết loại phí và số tiền, khi nào được tính phí</p>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="feeName">
              Tên phí <span className="text-red-500">*</span>
            </Label>
            {category === "other" ? (
              <Input
                id="feeName"
                value={feeName}
                onChange={(e) => setFeeName(e.target.value)}
                placeholder="Nhập tên phí"
                maxLength={100}
              />
            ) : (
              <Select value={feeName} onValueChange={setFeeName}>
                <SelectTrigger id="feeName">
                  <SelectValue placeholder="Chọn" />
                </SelectTrigger>
                <SelectContent>
                  {category && feeNamesByCategory[category]?.map(name => (
                    <SelectItem key={name} value={name}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="paymentFrequency">
              Tần suất thanh toán <span className="text-red-500">*</span>
            </Label>
            <Select value={paymentFrequency} onValueChange={setPaymentFrequency}>
              <SelectTrigger id="paymentFrequency">
                <SelectValue placeholder="Chọn" />
              </SelectTrigger>
              <SelectContent>
                {paymentFrequencies.map(freq => <SelectItem key={freq.value} value={freq.value}>
                    {freq.label}
                  </SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="feeType">
              Cách tính chi phí <span className="text-red-500">*</span>
            </Label>
            <Select value={feeType} onValueChange={setFeeType}>
              <SelectTrigger id="feeType">
                <SelectValue placeholder="Chọn" />
              </SelectTrigger>
              <SelectContent>
                {feeTypes.map(type => <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="min-h-[100px]">
            {feeType && feeType !== "usage-based" && (
              <>
                {feeType === "range" ? <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="minAmount">
                        Từ <span className="text-red-500">*</span>
                      </Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground z-10">
                          ₫
                        </span>
                        <NumberInput id="minAmount" value={minAmount} onChange={setMinAmount} className="pl-7" placeholder="0" allowDecimal={false} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="maxAmount">
                        Đến <span className="text-red-500">*</span>
                      </Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground z-10">
                          ₫
                        </span>
                        <NumberInput id="maxAmount" value={maxAmount} onChange={setMaxAmount} className="pl-7" placeholder="0" allowDecimal={false} />
                      </div>
                    </div>
                   </div> : <div className="space-y-2">
                  <Label htmlFor="amount">
                    Số tiền phí <span className="text-red-500">*</span>
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground z-10">
                      ₫
                    </span>
                    <NumberInput id="amount" value={amount} onChange={setAmount} className="pl-7" placeholder="0" allowDecimal={false} />
                  </div>
                </div>}
              </>
            )}
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="isRefundable" className="cursor-pointer">
              Được hoàn lại phí này?
            </Label>
            <Switch 
              id="isRefundable" 
              checked={isRefundable} 
              onCheckedChange={setIsRefundable}
              className="data-[state=checked]:bg-foreground"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Hủy
            </Button>
            <Button type="button" onClick={handleSave} disabled={!canSave} className="bg-foreground hover:bg-foreground/90 text-background">
              Lưu
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>;
};