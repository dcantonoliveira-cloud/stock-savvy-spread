// src/components/ItemImage.tsx
import React from 'react';
import { useItemImage } from '@/hooks/useItemImage';
import { Package } from 'lucide-react';

interface ItemImageProps {
  itemId: string;
  itemName: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeMap = {
  sm: 'w-8 h-8',
  md: 'w-12 h-12',
  lg: 'w-16 h-16',
};

const iconSizeMap = {
  sm: 16,
  md: 20,
  lg: 28,
};

export function ItemImage({ itemId, itemName, size = 'md', className = '' }: ItemImageProps) {
  const { imageUrl, loading } = useItemImage(itemId, itemName);

  const sizeClass = sizeMap[size];

  if (loading) {
    return (
      <div className={`${sizeClass} rounded-lg bg-gray-100 animate-pulse flex-shrink-0 ${className}`} />
    );
  }

  if (!imageUrl) {
    return (
      <div className={`${sizeClass} rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0 ${className}`}>
        <Package size={iconSizeMap[size]} className="text-gray-400" />
      </div>
    );
  }

  return (
    <img
      src={imageUrl}
      alt={itemName}
      className={`${sizeClass} rounded-lg object-cover flex-shrink-0 ${className}`}
      onError={(e) => {
        // Fallback se imagem falhar
        (e.target as HTMLImageElement).style.display = 'none';
      }}
    />
  );
}
