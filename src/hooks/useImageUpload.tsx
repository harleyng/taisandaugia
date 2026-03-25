import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export const useImageUpload = () => {
  const { toast } = useToast();
  const [images, setImages] = useState<File[]>([]);
  const [imagePreviewUrls, setImagePreviewUrls] = useState<string[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length + images.length > 10) {
      toast({
        title: "Quá nhiều ảnh",
        description: "Bạn chỉ có thể tải lên tối đa 10 ảnh",
        variant: "destructive",
      });
      return;
    }

    setImages([...images, ...files]);
    
    const newPreviews = files.map(file => URL.createObjectURL(file));
    setImagePreviewUrls([...imagePreviewUrls, ...newPreviews]);
  };

  const removeImage = (index: number) => {
    const newImages = images.filter((_, i) => i !== index);
    const newPreviews = imagePreviewUrls.filter((_, i) => i !== index);
    setImages(newImages);
    URL.revokeObjectURL(imagePreviewUrls[index]);
    setImagePreviewUrls(newPreviews);
  };

  const reorderImages = (newOrder: string[]) => {
    setImagePreviewUrls(newOrder);
    // Reorder the actual files to match
    const newImageFiles: File[] = [];
    newOrder.forEach((url) => {
      const index = imagePreviewUrls.indexOf(url);
      if (index !== -1 && images[index]) {
        newImageFiles.push(images[index]);
      }
    });
    setImages(newImageFiles);
  };

  const uploadImages = async (userId: string): Promise<string | null> => {
    if (images.length === 0) return null;

    setUploadingImages(true);
    try {
      const uploadedUrls: string[] = [];
      
      for (const image of images) {
        const fileExt = image.name.split('.').pop();
        const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('listing-images')
          .upload(fileName, image);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('listing-images')
          .getPublicUrl(fileName);

        uploadedUrls.push(publicUrl);
      }

      return uploadedUrls[0];
    } catch (error: any) {
      toast({
        title: "Lỗi tải ảnh",
        description: error.message,
        variant: "destructive",
      });
      return null;
    } finally {
      setUploadingImages(false);
    }
  };

  const resetImages = () => {
    imagePreviewUrls.forEach(url => URL.revokeObjectURL(url));
    setImages([]);
    setImagePreviewUrls([]);
  };

  return {
    images,
    imagePreviewUrls,
    uploadingImages,
    handleImageSelect,
    removeImage,
    reorderImages,
    uploadImages,
    resetImages,
  };
};
