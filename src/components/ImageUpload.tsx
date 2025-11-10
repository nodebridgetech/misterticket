import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, X, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface ImageUploadProps {
  currentImageUrl?: string;
  onImageUploaded: (url: string) => void;
  onImageRemoved: () => void;
}

export const ImageUpload = ({ currentImageUrl, onImageUploaded, onImageRemoved }: ImageUploadProps) => {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(currentImageUrl || null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Por favor, selecione uma imagem válida");
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("A imagem deve ter no máximo 5MB");
      return;
    }

    setUploading(true);

    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("event-images")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from("event-images")
        .getPublicUrl(filePath);

      setPreview(data.publicUrl);
      onImageUploaded(data.publicUrl);
      toast.success("Imagem enviada com sucesso!");
    } catch (error) {
      console.error("Error uploading image:", error);
      toast.error("Erro ao enviar imagem");
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveImage = () => {
    setPreview(null);
    onImageRemoved();
  };

  return (
    <div className="space-y-4">
      <Label htmlFor="image-upload">Imagem do Evento</Label>
      
      {preview ? (
        <div className="relative">
          <img
            src={preview}
            alt="Preview"
            className="w-full h-64 object-cover rounded-lg"
          />
          <Button
            type="button"
            variant="destructive"
            size="icon"
            className="absolute top-2 right-2"
            onClick={handleRemoveImage}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
          <Input
            id="image-upload"
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            disabled={uploading}
            className="hidden"
          />
          <Label
            htmlFor="image-upload"
            className="cursor-pointer flex flex-col items-center gap-2"
          >
            {uploading ? (
              <>
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Enviando...</span>
              </>
            ) : (
              <>
                <Upload className="h-8 w-8 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  Clique para selecionar uma imagem
                </span>
                <span className="text-xs text-muted-foreground">
                  PNG, JPG ou WEBP (máx. 5MB)
                </span>
              </>
            )}
          </Label>
        </div>
      )}
    </div>
  );
};
