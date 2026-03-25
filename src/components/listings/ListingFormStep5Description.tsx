import { useState, KeyboardEvent } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";

interface ListingFormStep5DescriptionProps {
  title: string;
  setTitle: (value: string) => void;
  description: string;
  setDescription: (value: string) => void;
  prominentFeatures: string;
  setProminentFeatures: (value: string) => void;
}

export const ListingFormStep5Description = ({
  title,
  setTitle,
  description,
  setDescription,
  prominentFeatures,
  setProminentFeatures,
}: ListingFormStep5DescriptionProps) => {
  const [currentFeature, setCurrentFeature] = useState("");
  const [features, setFeatures] = useState<string[]>(() => {
    return prominentFeatures ? prominentFeatures.split(",").map(f => f.trim()).filter(Boolean) : [];
  });

  const handleFeatureKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && currentFeature.trim()) {
      e.preventDefault();
      const newFeature = currentFeature.trim();
      if (newFeature && !features.includes(newFeature)) {
        const updatedFeatures = [...features, newFeature];
        setFeatures(updatedFeatures);
        setProminentFeatures(updatedFeatures.join(", "));
        setCurrentFeature("");
      }
    }
  };

  const removeFeature = (index: number) => {
    const updatedFeatures = features.filter((_, i) => i !== index);
    setFeatures(updatedFeatures);
    setProminentFeatures(updatedFeatures.join(", "));
  };

  return (
    <div className="space-y-6">
      <div className="mb-8">
        <h2 className="text-3xl font-semibold mb-2">Mô tả</h2>
        <p className="text-muted-foreground text-lg">
          Viết mô tả chi tiết để thu hút khách hàng
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="title">Tiêu đề tin đăng <span className="text-destructive">*</span></Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Ví dụ: Bán căn hộ 3PN view đẹp Vinhomes Central Park"
          maxLength={100}
          required
        />
        <p className="text-xs text-muted-foreground">{title.length}/100 ký tự</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Mô tả chi tiết <span className="text-destructive">*</span></Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Mô tả chi tiết về bất động sản, vị trí, tiện ích xung quanh..."
          rows={8}
          required
        />
        <p className="text-xs text-muted-foreground">{description.length} ký tự (Tối thiểu 80)</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="prominentFeatures">Đặc điểm nổi bật</Label>
        <div 
          className="flex flex-wrap gap-2 min-h-[42px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2"
          onClick={(e) => {
            const input = e.currentTarget.querySelector('input');
            if (input) input.focus();
          }}
        >
          {features.map((feature, index) => (
            <Badge key={index} variant="secondary" className="text-sm px-3 py-1">
              {feature}
              <button
                type="button"
                onClick={() => removeFeature(index)}
                className="ml-2 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          <input
            id="prominentFeatures"
            value={currentFeature}
            onChange={(e) => setCurrentFeature(e.target.value)}
            onKeyDown={handleFeatureKeyDown}
            placeholder={features.length === 0 ? "Nhập đặc điểm và nhấn Enter" : ""}
            maxLength={50}
            className="flex-1 min-w-[120px] outline-none bg-transparent placeholder:text-muted-foreground"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Nhập đặc điểm nổi bật và nhấn Enter để thêm
        </p>
      </div>
    </div>
  );
};
