// src/hooks/useItemImage.ts
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { fetchItemImage } from '@/services/unsplashService';

export function useItemImage(itemId: string, itemName: string) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!itemId || !itemName) return;

    async function loadImage() {
      setLoading(true);

      try {
        // 1. Verifica se já tem imagem salva no Supabase
        const { data } = await supabase
          .from('stock_items')
          .select('image_url')
          .eq('id', itemId)
          .single();

        if (data?.image_url) {
          setImageUrl(data.image_url);
          setLoading(false);
          return;
        }

        // 2. Busca na Unsplash
        const url = await fetchItemImage(itemName);

        if (url) {
          setImageUrl(url);

          // 3. Salva no Supabase para não buscar de novo
          await supabase
            .from('stock_items')
            .update({ image_url: url })
            .eq('id', itemId);
        }
      } catch (error) {
        console.error('Error loading item image:', error);
      } finally {
        setLoading(false);
      }
    }

    loadImage();
  }, [itemId, itemName]);

  return { imageUrl, loading };
}
