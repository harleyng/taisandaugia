import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

interface ImageGalleryProps {
  images: string[];
  title: string;
}

export const ImageGallery = ({ images, title }: ImageGalleryProps) => {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  if (!images || images.length === 0) {
    return (
      <div className="aspect-video w-full bg-muted rounded-lg flex items-center justify-center">
        <p className="text-muted-foreground">Chưa có hình ảnh</p>
      </div>
    );
  }

  const handlePrevious = () => {
    if (selectedIndex !== null) {
      setSelectedIndex((selectedIndex - 1 + images.length) % images.length);
    }
  };

  const handleNext = () => {
    if (selectedIndex !== null) {
      setSelectedIndex((selectedIndex + 1) % images.length);
    }
  };

  return (
    <>
      <div className="space-y-4">
        {/* Main Image */}
        <div 
          className="aspect-video w-full rounded-lg overflow-hidden cursor-pointer relative group"
          onClick={() => setSelectedIndex(0)}
        >
          <img
            src={images[0]}
            alt={`${title} - Ảnh chính`}
            className="w-full h-full object-cover transition-transform group-hover:scale-105"
            onError={(e) => {
              e.currentTarget.src = "/placeholder.svg";
            }}
          />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
            <span className="text-white opacity-0 group-hover:opacity-100 transition-opacity">
              Xem tất cả {images.length} ảnh
            </span>
          </div>
        </div>

        {/* Thumbnail Grid */}
        {images.length > 1 && (
          <div className="grid grid-cols-4 gap-2">
            {images.slice(1, 5).map((image, index) => (
              <div
                key={index}
                className="aspect-video rounded-lg overflow-hidden cursor-pointer relative group"
                onClick={() => setSelectedIndex(index + 1)}
              >
                <img
                  src={image}
                  alt={`${title} - Ảnh ${index + 2}`}
                  className="w-full h-full object-cover transition-transform group-hover:scale-105"
                  onError={(e) => {
                    e.currentTarget.src = "/placeholder.svg";
                  }}
                />
                {index === 3 && images.length > 5 && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                    <span className="text-white font-semibold">+{images.length - 5}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Fullscreen Dialog */}
      <Dialog open={selectedIndex !== null} onOpenChange={() => setSelectedIndex(null)}>
        <DialogContent className="max-w-7xl w-full h-[90vh] p-0">
          <div className="relative w-full h-full flex items-center justify-center bg-black">
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-4 right-4 z-50 text-white hover:bg-white/20"
              onClick={() => setSelectedIndex(null)}
            >
              <X className="h-6 w-6" />
            </Button>

            {selectedIndex !== null && (
              <>
                <img
                  src={images[selectedIndex]}
                  alt={`${title} - Ảnh ${selectedIndex + 1}`}
                  className="max-w-full max-h-full object-contain"
                  onError={(e) => {
                    e.currentTarget.src = "/placeholder.svg";
                  }}
                />

                {images.length > 1 && (
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute left-4 text-white hover:bg-white/20"
                      onClick={handlePrevious}
                    >
                      <ChevronLeft className="h-8 w-8" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-4 text-white hover:bg-white/20"
                      onClick={handleNext}
                    >
                      <ChevronRight className="h-8 w-8" />
                    </Button>

                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 px-4 py-2 rounded-full text-white">
                      {selectedIndex + 1} / {images.length}
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
