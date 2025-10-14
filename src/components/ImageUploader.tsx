import React, { useCallback } from 'react';

interface ImageUploaderProps {
  onImageUpload: (file: File) => void;
  title: string;
  description: string;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({ onImageUpload, title, description }) => {
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onImageUpload(file);
    }
  };

  const onDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
        onImageUpload(file);
    }
  }, [onImageUpload]);

  const onDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  return (
    <div 
      className="w-full max-w-lg mx-auto bg-gray-800 border-2 border-dashed border-gray-600 rounded-xl p-8 text-center cursor-pointer hover:border-indigo-500 transition-colors duration-300"
      onDrop={onDrop}
      onDragOver={onDragOver}
      onClick={() => document.getElementById('file-input')?.click()}
    >
      <input
        id="file-input"
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />
      <div className="flex flex-col items-center">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-500 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
        </svg>
        <h3 className="text-xl font-semibold text-gray-200 mb-2">{title}</h3>
        <p className="text-gray-400">{description}</p>
      </div>
    </div>
  );
};