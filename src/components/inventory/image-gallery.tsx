'use client';

import { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Camera, Upload, Trash2, Star, Image as ImageIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { ProductImage } from '@/store/inventory-store';

interface ImageGalleryProps {
  images: ProductImage[];
  productId: string;
  onUpload: (file: File, isPrimary?: boolean) => Promise<void>;
  onDelete: (imageId: string) => Promise<void>;
  onSetPrimary: (imageId: string) => Promise<void>;
  readOnly?: boolean;
}

export function ImageGallery({ images, productId, onUpload, onDelete, onSetPrimary, readOnly }: ImageGalleryProps) {
  const [uploading, setUploading] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>, isCamera: boolean = false) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        await onUpload(file, images.length === 0);
      }
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }, [onUpload, images.length]);

  const handleDelete = async (imageId: string) => {
    await onDelete(imageId);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-foreground">Product Images</label>
        {!readOnly && (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => cameraInputRef.current?.click()}
              disabled={uploading}
              className="h-9"
            >
              <Camera className="h-4 w-4 mr-1" />
              Take Photo
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="h-9"
            >
              <Upload className="h-4 w-4 mr-1" />
              Upload
            </Button>
          </div>
        )}
      </div>

      {/* Hidden inputs */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(e) => handleFileSelect(e, true)}
        className="hidden"
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={(e) => handleFileSelect(e, false)}
        className="hidden"
      />

      {/* Image grid */}
      {images.length > 0 ? (
        <div className="grid grid-cols-3 gap-2">
          {images
            .sort((a, b) => {
              if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
              return a.displayOrder - b.displayOrder;
            })
            .map((image) => (
              <div key={image.id} className="relative group aspect-square rounded-lg overflow-hidden border bg-muted">
                <img
                  src={image.imageUrl}
                  alt="Product"
                  className="w-full h-full object-cover cursor-pointer"
                  onClick={() => setPreviewImage(image.imageUrl)}
                />
                {image.isPrimary && (
                  <div className="absolute top-1 left-1">
                    <Badge className="bg-amber-500 text-white text-[10px] px-1.5 py-0.5">
                      <Star className="h-3 w-3 mr-0.5" />
                      Primary
                    </Badge>
                  </div>
                )}
                {!readOnly && (
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                    {!image.isPrimary && (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => onSetPrimary(image.id)}
                        title="Set as primary"
                      >
                        <Star className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => handleDelete(image.id)}
                      title="Delete image"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
        </div>
      ) : (
        <div className="border-2 border-dashed rounded-lg p-8 text-center text-muted-foreground">
          <ImageIcon className="h-10 w-10 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No images yet</p>
          {!readOnly && (
            <p className="text-xs mt-1">Take a photo or upload images</p>
          )}
        </div>
      )}

      {uploading && (
        <div className="flex items-center justify-center py-2">
          <div className="animate-spin rounded-full h-5 w-5 border-2 border-primary border-t-transparent" />
          <span className="ml-2 text-sm text-muted-foreground">Uploading...</span>
        </div>
      )}

      {/* Image preview dialog */}
      <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
        <DialogContent className="max-w-lg p-2">
          <DialogTitle className="sr-only">Image Preview</DialogTitle>
          {previewImage && (
            <img src={previewImage} alt="Product preview" className="w-full rounded-md" />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
