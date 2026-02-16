import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { X, Plus, ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface MultiImageUploadProps {
  label: string;
  existingUrls: string[];
  onUrlsChange: (urls: string[]) => void;
  folder: string;
  maxImages?: number;
}

export const MultiImageUpload = ({
  label,
  existingUrls,
  onUrlsChange,
  folder,
  maxImages = 5,
}: MultiImageUploadProps) => {
  const [uploading, setUploading] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [pendingPreviews, setPendingPreviews] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const remainingSlots = maxImages - existingUrls.length - pendingFiles.length;
    const filesToAdd = files.slice(0, remainingSlots);

    if (filesToAdd.length > 0) {
      setPendingFiles((prev) => [...prev, ...filesToAdd]);
      
      // Create previews for new files
      filesToAdd.forEach((file) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          setPendingPreviews((prev) => [...prev, reader.result as string]);
        };
        reader.readAsDataURL(file);
      });
    }

    // Reset input
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  const removePendingFile = (index: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
    setPendingPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const removeExistingUrl = async (index: number) => {
    const urlToRemove = existingUrls[index];
    
    // Try to delete from storage
    try {
      const path = urlToRemove.split("/employee-photos/")[1];
      if (path) {
        await supabase.storage.from("employee-photos").remove([path]);
      }
    } catch (error) {
      console.error("Error deleting file from storage:", error);
    }

    const newUrls = existingUrls.filter((_, i) => i !== index);
    onUrlsChange(newUrls);
  };

  const uploadPendingFiles = async (): Promise<string[]> => {
    if (pendingFiles.length === 0) return [];

    setUploading(true);
    const uploadedUrls: string[] = [];

    try {
      for (const file of pendingFiles) {
        const fileExt = file.name.split(".").pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `${folder}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("employee-photos")
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data } = supabase.storage.from("employee-photos").getPublicUrl(filePath);
        uploadedUrls.push(data.publicUrl);
      }

      // Clear pending files after successful upload
      setPendingFiles([]);
      setPendingPreviews([]);

      return uploadedUrls;
    } catch (error) {
      console.error("Error uploading files:", error);
      return [];
    } finally {
      setUploading(false);
    }
  };

  const totalImages = existingUrls.length + pendingFiles.length;
  const canAddMore = totalImages < maxImages;

  return (
    <div className="space-y-2">
      <Label>{label} ({totalImages}/{maxImages})</Label>
      
      <div className="flex flex-wrap gap-2">
        {/* Existing images */}
        {existingUrls.map((url, index) => (
          <div key={`existing-${index}`} className="relative group">
            <img
              src={url}
              alt={`${label} ${index + 1}`}
              className="w-20 h-20 object-cover rounded-lg border"
            />
            <button
              type="button"
              onClick={() => removeExistingUrl(index)}
              className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}

        {/* Pending files previews */}
        {pendingPreviews.map((preview, index) => (
          <div key={`pending-${index}`} className="relative group">
            <img
              src={preview}
              alt={`Pending ${index + 1}`}
              className="w-20 h-20 object-cover rounded-lg border border-dashed border-primary"
            />
            <div className="absolute inset-0 bg-primary/10 rounded-lg flex items-center justify-center">
              <span className="text-xs text-primary font-medium">Chờ lưu</span>
            </div>
            <button
              type="button"
              onClick={() => removePendingFile(index)}
              className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}

        {/* Add button */}
        {canAddMore && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="w-20 h-20 border-2 border-dashed border-muted-foreground/30 rounded-lg flex flex-col items-center justify-center gap-1 hover:border-primary hover:bg-primary/5 transition-colors"
          >
            <Plus className="w-5 h-5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Thêm</span>
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileSelect}
        className="hidden"
      />

      {totalImages === 0 && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <ImageIcon className="w-4 h-4" />
          <span>Chưa có ảnh. Nhấn vào nút Thêm để upload.</span>
        </div>
      )}
    </div>
  );
};

// Export the upload function for parent components to use
export const uploadPendingFilesToStorage = async (
  pendingFiles: File[],
  folder: string
): Promise<string[]> => {
  if (pendingFiles.length === 0) return [];

  const uploadedUrls: string[] = [];

  for (const file of pendingFiles) {
    const fileExt = file.name.split(".").pop();
    const fileName = `${Math.random()}.${fileExt}`;
    const filePath = `${folder}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from("employee-photos")
      .upload(filePath, file);

    if (!uploadError) {
      const { data } = supabase.storage.from("employee-photos").getPublicUrl(filePath);
      uploadedUrls.push(data.publicUrl);
    }
  }

  return uploadedUrls;
};