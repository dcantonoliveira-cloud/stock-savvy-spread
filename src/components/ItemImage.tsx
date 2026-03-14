import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { fetchItemImage } from '@/services/unsplashService';
import { Loader2, RefreshCw, ImageOff } from 'lucide-react';
import { Button } from '@/components/ui/button';

const AVATAR_COLORS = [
  { bg: 'hsl(38 75% 52% / 0.15)', text: 'hsl(38 70% 40%)', border: 'hsl(38 75% 52% / 0.25)' },
  { bg: 'hsl(222 35% 14% / 0.08)', text: 'hsl(222 35% 30%)', border: 'hsl(222 35% 14% / 0.15)' },
  { bg: 'hsl(152 55% 38% / 0.12)', text: 'hsl(152 55% 30%)', border: 'hsl(152 55% 38% / 0.2)' },
  { bg: 'hsl(200 80% 45% / 0.12)', text: 'hsl(200 80% 35%)', border: 'hsl(200 80% 45% / 0.2)' },
  { bg: 'hsl(280 60% 50% / 0.10)', text: 'hsl(280 60% 38%)', border: 'hsl(280 60% 50% / 0.18)' },
];

function getAvatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

interface ItemImageProps {
  itemId: string;
  itemName: string;
  imageUrl?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  editMode?: boolean;
  onImageUpdate?: (url: string | null) => void;
}

const sizeMap = { sm: 'w-8 h-8', md: 'w-10 h-10', lg: 'w-16 h-16' };
const fontSizeMap = { sm: 'text-xs', md: 'text-sm', lg: 'text-xl' };

export function ItemImage({
  itemId, itemName, imageUrl, size = 'md',
  className = '', editMode = false, onImageUpdate
}: ItemImageProps) {
  const [loading, setLoading] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [currentUrl, setCurrentUrl] = useState(imageUrl);

  const sizeClass = sizeMap[size];
  const fontClass = fontSizeMap[size];
  const initial = itemName?.charAt(0)?.toUpperCase() || '?';
  const color = getAvatarColor(itemName || '');

  const searchImage = async () => {
    setLoading(true);
    setImgError(false);
    try {
      const url = await fetchItemImage(itemName);
      if (url) {
        setCurrentUrl(url);
        await supabase.from('stock_items').update({ image_url: url } as any).eq('id', itemId);
        onImageUpdate?.(url);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const removeImage = async () => {
    setCurrentUrl(null);
    setImgError(false);
    await supabase.from('stock_items').update({ image_url: null } as any).eq('id', itemId);
    onImageUpdate?.(null);
  };

  const hasImage = currentUrl && !imgError;

  const visual = hasImage ? (
    <img
      src={currentUrl}
      alt={itemName}
      className={`${sizeClass} rounded-xl object-cover flex-shrink-0 ${className}`}
      onError={() => setImgError(true)}
    />
  ) : (
    <div
      className={`${sizeClass} rounded-xl flex items-center justify-center flex-shrink-0 font-bold ${fontClass} ${className}`}
      style={{ background: color.bg, color: color.text, border: `1px solid ${color.border}` }}
    >
      {initial}
    </div>
  );

  if (!editMode) return visual;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative">
        {visual}
        {loading && (
          <div className={`absolute inset-0 rounded-xl bg-black/20 flex items-center justify-center`}>
            <Loader2 className="w-4 h-4 animate-spin text-white" />
          </div>
        )}
      </div>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={searchImage}
          disabled={loading}
          className="text-xs h-7 px-2.5"
        >
          {loading
            ? <Loader2 className="w-3 h-3 animate-spin mr-1" />
            : <RefreshCw className="w-3 h-3 mr-1" />
          }
          {hasImage ? 'Buscar outra' : 'Buscar imagem'}
        </Button>
        {hasImage && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={removeImage}
            className="text-xs h-7 px-2 text-muted-foreground hover:text-destructive"
          >
            <ImageOff className="w-3 h-3" />
          </Button>
        )}
      </div>
    </div>
  );
}
