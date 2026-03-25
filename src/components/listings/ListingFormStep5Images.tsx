import { ListingFormImages } from "./ListingFormImages";

interface ListingFormStep5ImagesProps {
  imagePreviewUrls: string[];
  setImagePreviewUrls: (urls: string[]) => void;
  onImageSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveImage: (index: number) => void;
}

export const ListingFormStep5Images = ({
  imagePreviewUrls,
  setImagePreviewUrls,
  onImageSelect,
  onRemoveImage,
}: ListingFormStep5ImagesProps) => {
  const handleReorderImages = (newOrder: string[]) => {
    setImagePreviewUrls(newOrder);
  };

  return (
    <div className="space-y-6">
      <div className="mb-8">
        <h2 className="text-3xl font-semibold mb-2">Hình ảnh</h2>
        <p className="text-muted-foreground text-lg">
          Thêm hình ảnh để thu hút khách hàng
        </p>
      </div>

      <ListingFormImages
        imagePreviewUrls={imagePreviewUrls}
        onImageSelect={onImageSelect}
        onRemoveImage={onRemoveImage}
        onReorderImages={handleReorderImages}
      />
    </div>
  );
};
