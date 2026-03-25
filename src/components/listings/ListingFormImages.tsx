import { Label } from "@/components/ui/label";
import { Upload, X, GripVertical } from "lucide-react";
import { useState } from "react";

interface ListingFormImagesProps {
  imagePreviewUrls: string[];
  onImageSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveImage: (index: number) => void;
  onReorderImages?: (newOrder: string[]) => void;
}

export const ListingFormImages = ({
  imagePreviewUrls,
  onImageSelect,
  onRemoveImage,
  onReorderImages,
}: ListingFormImagesProps) => {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    
    // Create a proper drag image preview
    const dragImage = new Image();
    dragImage.src = imagePreviewUrls[index];
    dragImage.style.width = '150px';
    dragImage.style.height = '150px';
    dragImage.style.objectFit = 'cover';
    dragImage.style.borderRadius = '8px';
    dragImage.style.position = 'absolute';
    dragImage.style.top = '-1000px';
    document.body.appendChild(dragImage);
    
    e.dataTransfer.setDragImage(dragImage, 75, 75);
    
    // Clean up after a short delay
    setTimeout(() => {
      document.body.removeChild(dragImage);
    }, 0);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newImages = [...imagePreviewUrls];
    const draggedImage = newImages[draggedIndex];
    newImages.splice(draggedIndex, 1);
    newImages.splice(index, 0, draggedImage);

    if (onReorderImages) {
      onReorderImages(newImages);
    }
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  return (
    <div className="space-y-4">
      <Label>Hình ảnh <span className="text-destructive">*</span></Label>
      
      {imagePreviewUrls.length === 0 ? (
        <div className="border-2 border-dashed rounded-lg p-6 text-center">
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={onImageSelect}
            className="hidden"
            id="image-upload"
          />
          <label htmlFor="image-upload" className="cursor-pointer">
            <Upload className="mx-auto h-12 w-12 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">
              Nhấn để chọn ảnh (tối đa 10 ảnh)
            </p>
          </label>
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground mb-2">Kéo và thả để sắp xếp lại</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
            {imagePreviewUrls.map((url, index) => (
              <div
                key={index}
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
                className={`relative group cursor-move transition-all ${draggedIndex === index ? 'opacity-30 scale-95' : ''}`}
              >
                <div className="absolute top-2 left-2 bg-background/80 rounded p-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                  <GripVertical className="h-5 w-5 text-muted-foreground" />
                </div>
                <img
                  src={url}
                  alt={`Hình ${index + 1}`}
                  className="w-full h-48 object-cover rounded-lg select-none"
                />
                <button
                  type="button"
                  onClick={() => onRemoveImage(index)}
                  className="absolute top-2 right-2 bg-foreground text-background rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="h-5 w-5" />
                </button>
                {index === 0 && (
                  <div className="absolute bottom-2 left-2 bg-foreground text-background px-2 py-1 rounded text-xs font-medium">
                    Ảnh bìa
                  </div>
                )}
              </div>
            ))}
            
            {imagePreviewUrls.length < 10 && (
              <div className="border-2 border-dashed rounded-lg flex flex-col items-center justify-center h-48">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={onImageSelect}
                  className="hidden"
                  id="image-upload-more"
                />
                <label htmlFor="image-upload-more" className="cursor-pointer text-center p-4 w-full h-full flex flex-col items-center justify-center">
                  <Upload className="h-10 w-10 text-muted-foreground" />
                  <p className="mt-2 text-sm text-muted-foreground">Thêm ảnh</p>
                  <p className="text-sm text-muted-foreground font-medium mt-1">{imagePreviewUrls.length}/10</p>
                </label>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
