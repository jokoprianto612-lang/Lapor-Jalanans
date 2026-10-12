// Image Upload Component
'use client';

import { useState, useRef, useCallback } from 'react';
import { Button, Card } from '@/components/ui';
import { X, Image as ImageIcon, Upload, CheckCircle, AlertCircle } from 'lucide-react';
import { clsx } from 'clsx';

interface ImageUploadProps {
  onUpload: (images: string[]) => void;
  onClose: () => void;
  maxFiles?: number;
  existingImages?: string[];
}

export function ImageUpload({ onUpload, onClose, maxFiles = 5, existingImages = [] }: ImageUploadProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const totalImages = existingImages.length + files.length;
  const remainingSlots = maxFiles - existingImages.length;

  const validateFile = (file: File): string | null => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
    if (!allowedTypes.includes(file.type)) {
      return `File ${file.name}: Format tidak didukung (gunakan JPG, PNG, WebP)`;
    }
    if (file.size > 10 * 1024 * 1024) {
      return `File ${file.name}: Ukuran terlalu besar (maks 10MB)`;
    }
    return null;
  };

  const handleFiles = useCallback((newFiles: FileList | File[]) => {
    const fileArray = Array.from(newFiles);
    const validFiles: File[] = [];
    const newErrors: string[] = [];
    
    for (const file of fileArray) {
      const error = validateFile(file);
      if (error) {
        newErrors.push(error);
      } else if (validFiles.length < remainingSlots) {
        validFiles.push(file);
      } else {
        newErrors.push(`Maksimal ${maxFiles} foto (tersisa ${remainingSlots} slot)`);
        break;
      }
    }
    
    if (validFiles.length > 0) {
      setFiles(prev => [...prev, ...validFiles]);
      // Create previews
      validFiles.forEach(file => {
        const url = URL.createObjectURL(file);
        setPreviews(prev => [...prev, url]);
      });
    }
    
    if (newErrors.length > 0) {
      setErrors(newErrors);
      // Clear errors after 5 seconds
      setTimeout(() => setErrors([]), 5000);
    }
  }, [remainingSlots, maxFiles]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  }, [handleFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const removeFile = (index: number) => {
    URL.revokeObjectURL(previews[index]);
    setFiles(prev => prev.filter((_, i) => i !== index));
    setPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (files.length === 0) return;
    
    setUploading(true);
    try {
      // Convert to base64
      const base64Images = await Promise.all(
        files.map(file => new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        }))
      );
      
      onUpload(base64Images);
      onClose();
    } catch (error) {
      setErrors(['Gagal memproses gambar']);
    } finally {
      setUploading(false);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-hidden animate-in">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-secondary-200 dark:border-secondary-700">
          <h2 className="text-lg font-semibold">Tambah Foto Kerusakan</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>
        
        {/* Drop Zone */}
        <div 
          className={clsx(
            'relative p-6 border-2 border-dashed border-secondary-300 dark:border-secondary-600',
            'rounded-xl mx-4 mt-4 mb-2 transition-colors',
            files.length > 0 ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' : 'hover:border-primary-500'
          )}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onClick={triggerFileInput}
          role="button"
          tabIndex={0}
          aria-label="Drop zone untuk upload foto"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic"
            multiple
            onChange={handleInputChange}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            disabled={totalImages >= maxFiles}
          />
          
          <div className="flex flex-col items-center gap-3 text-center">
            <div className={clsx('w-16 h-16 rounded-full flex items-center justify-center', 
              files.length > 0 ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-600' : 'bg-secondary-100 dark:bg-secondary-800 text-secondary-500'
            )}>
              <ImageIcon className="w-8 h-8" />
            </div>
            
            {totalImages >= maxFiles ? (
              <>
                <p className="text-sm font-medium text-secondary-600 dark:text-secondary-300">
                  Maksimal {maxFiles} foto tercapai
                </p>
                <p className="text-xs text-secondary-500">
                  {existingImages.length} existing + {files.length} baru
                </p>
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-secondary-900 dark:text-white">
                  Seret & lepas foto di sini atau klik untuk pilih
                </p>
                <p className="text-xs text-secondary-500">
                  Maks {maxFiles} foto • JPG, PNG, WebP, HEIC • Maks 10MB/file
                  <br />
                  Tersisa {remainingSlots} slot
                </p>
              </>
            )}
            
            <Upload className="w-5 h-5 opacity-50" />
          </div>
        </div>
        
        {/* Previews */}
        {(previews.length > 0 || existingImages.length > 0) && (
          <div className="px-4 pb-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-secondary-700 dark:text-secondary-300">
                Pratinjau ({totalImages}/{maxFiles})
              </h3>
            </div>
            
            <div className="flex gap-2 overflow-x-auto pb-2">
              {/* Existing images */}
              {existingImages.map((img, idx) => (
                <div key={`existing-${idx}`} className="relative flex-shrink-0 w-24 h-24 rounded-lg overflow-hidden border border-secondary-200 dark:border-secondary-700">
                  <img src={img} alt={`Existing ${idx + 1}`} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                    <span className="text-xs text-white/80 bg-black/50 px-2 py-1 rounded">Existing</span>
                  </div>
                </div>
              ))}
              
              {/* New files */}
              {previews.map((preview, idx) => (
                <div key={`new-${idx}`} className="relative flex-shrink-0 w-24 h-24 rounded-lg overflow-hidden">
                  <img src={preview} alt={`Preview ${idx + 1}`} className="w-full h-full object-cover" />
                  <button
                    onClick={() => removeFile(idx)}
                    className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition-colors"
                    aria-label="Hapus foto"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  <div className="absolute bottom-1 left-1 right-1 bg-black/50 text-white text-xs text-center px-1 rounded">
                    Baru
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Errors */}
        {errors.length > 0 && (
          <div className="px-4 pb-2">
            <div className="flex flex-wrap gap-1">
              {errors.map((error, idx) => (
                <div key={idx} className="flex items-center gap-1.5 px-3 py-2 bg-danger-50 dark:bg-danger-900/30 border border-danger-200 dark:border-danger-800 rounded-lg text-danger-700 dark:text-danger-300 text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-secondary-200 dark:border-secondary-700">
          <Button variant="ghost" onClick={onClose} disabled={uploading}>
            Batal
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={files.length === 0 || uploading || totalImages >= maxFiles}
            className="ml-auto"
          >
            {uploading ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                Memproses...
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4" />
                Tambahkan {files.length} Foto
              </>
            )}
          </Button>
        </div>
      </Card>
    </div>
  );
}