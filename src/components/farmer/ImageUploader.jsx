import { useState, useRef, memo } from 'react';

/**
 * Image Uploader Component
 * Allows uploading 1-3 product images with preview
 * 
 * Props:
 * - images: Array of base64 data URLs
 * - onChange: (images) => void
 * - maxImages: number (default 3)
 */
function ImageUploaderComponent({ images = [], onChange, maxImages = 3 }) {
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files || []);
    
    if (files.length === 0) return;

    // Check max limit
    if (images.length + files.length > maxImages) {
      setError(`Maximum ${maxImages} images allowed`);
      return;
    }

    setError(null);

    // Convert files to base64
    files.forEach((file) => {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setError('Only image files are allowed');
        return;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setError('Image size must be less than 5MB');
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target.result;
        onChange([...images, dataUrl]);
      };
      reader.readAsDataURL(file);
    });

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeImage = (index) => {
    const newImages = images.filter((_, i) => i !== index);
    onChange(newImages);
    setError(null);
  };

  const canAddMore = images.length < maxImages;

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-3">
        Product Images ({images.length}/{maxImages})
      </label>

      {/* Error message */}
      {error && (
        <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
          {error}
        </div>
      )}

      {/* Image grid */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        {/* Existing images */}
        {images.map((image, index) => (
          <div key={index} className="relative group">
            <div className="aspect-square rounded-xl overflow-hidden border-2 border-gray-200 bg-gray-100">
              <img
                src={image}
                alt={`Product ${index + 1}`}
                className="w-full h-full object-cover"
              />
            </div>
            {/* Remove button */}
            <button
              type="button"
              onClick={() => removeImage(index)}
              className="absolute -top-2 -right-2 w-8 h-8 bg-red-500 text-white rounded-full 
                         flex items-center justify-center shadow-lg
                         opacity-0 group-hover:opacity-100 transition-opacity
                         hover:bg-red-600"
              title="Remove image"
            >
              ✕
            </button>
          </div>
        ))}

        {/* Add more button */}
        {canAddMore && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="aspect-square rounded-xl border-2 border-dashed border-gray-300
                       flex flex-col items-center justify-center gap-2
                       text-gray-500 hover:border-green-500 hover:text-green-600
                       transition-colors bg-gray-50 hover:bg-green-50"
          >
            <span className="text-4xl">📷</span>
            <span className="text-sm font-medium">Add Photo</span>
          </button>
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Help text */}
      <p className="text-xs text-gray-500">
        Upload up to {maxImages} images. Each image must be less than 5MB.
      </p>
    </div>
  );
}

export const ImageUploader = memo(ImageUploaderComponent);
