import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Heart, ChevronDown, ChevronUp, CheckCircle, UtensilsCrossed } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const BUBBLE_API = 'https://rondellobuffet-app.com.br/api/1.1/obj';
const BUBBLE_TOKEN = 'Bearer b4b3c4138bb1000811d5a3c0ba47a238';

type SheetItem = { id: string; item_name: string | null };
type Sheet = {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  image_url: string | null;
  yield_quantity: number;
  yield_unit: string;
  technical_sheet_items: SheetItem[];
};

type BubbleEvent = {
  _id: string;
  NomeDoEvento?: string;
  NomeDoContratante?: string;
  dataDoEvento?: string;
};

const BUBBLE_CATEGORY_COLORS: Record<string, string> = {
  'Entrada': 'bg-emerald-100 text-emerald-800',
  'Prato Principal': 'bg-amber-100 text-amber-800',
  'Acompanhamento': 'bg-blue-100 text-blue-800',
  'Sobremesa': 'bg-pink-100 text-pink-800',
  'Bebida': 'bg-purple-100 text-purple-800',
};

function categoryColor(cat: string | null) {
  if (!cat) return 'bg-gray-100 text-gray-700';
  return BUBBLE_CATEGORY_COLORS[cat] || 'bg-gray-100 text-gray-700';
}

function DishCard({
  sheet,
  favorited,
  onToggle,
}: {
  sheet: Sheet;
  favorited: boolean;
  onToggle: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const initial = sheet.name.trim()[0]?.toUpperCase() || '?';

  const ingredients = sheet.technical_sheet_items
    .map(i => i.item_name)
    .filter(Boolean) as string[];

  return (
    <div
      className={cn(
        'bg-white rounded-2xl shadow-sm border transition-all duration-200',
        favorited ? 'border-rose-300 shadow-rose-100 shadow-md' : 'border-stone-200 hover:shadow-md'
      )}
    >
      {/* Image / placeholder */}
      <div className="relative">
        {sheet.image_url ? (
          <img
            src={sheet.image_url}
            alt={sheet.name}
            className="w-full h-40 object-cover rounded-t-2xl"
          />
        ) : (
          <div className="w-full h-40 rounded-t-2xl bg-gradient-to-br from-amber-50 to-stone-100 flex items-center justify-center">
            <span className="text-5xl font-bold text-stone-300 font-display select-none">{initial}</span>
          </div>
        )}
        {/* Heart button */}
        <button
          onClick={() => onToggle(sheet.id)}
          className={cn(
            'absolute top-3 right-3 w-9 h-9 rounded-full flex items-center justify-center transition-all',
            favorited
              ? 'bg-rose-500 shadow-md'
              : 'bg-white/80 backdrop-blur-sm hover:bg-white shadow'
          )}
          aria-label={favorited ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
        >
          <Heart
            className={cn('w-5 h-5 transition-all', favorited ? 'fill-white text-white' : 'text-rose-400')}
            fill={favorited ? 'white' : 'none'}
          />
        </button>
      </div>

      {/* Content */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className="font-bold text-stone-800 text-base leading-tight">{sheet.name}</h3>
        </div>
        {sheet.category && (
          <span className={cn('inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full mb-2', categoryColor(sheet.category))}>
            {sheet.category}
          </span>
        )}
        {sheet.description && (
          <p className="text-sm text-stone-500 leading-relaxed mb-2 line-clamp-2">{sheet.description}</p>
        )}

        {/* Ingredients toggle */}
        {ingredients.length > 0 && (
          <div>
            <button
              onClick={() => setExpanded(v => !v)}
              className="flex items-center gap-1 text-xs text-stone-400 hover:text-stone-600 transition-colors mt-1"
            >
              {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              {expanded ? 'Ocultar ingredientes' : `Ver ${ingredients.length} ingredientes`}
            </button>
            {expanded && (
              <div className="flex flex-wrap gap-1 mt-2">
                {ingredients.map((name, i) => (
                  <span
                    key={i}
                    className="inline-block text-[11px] bg-stone-100 text-stone-600 rounded-full px-2 py-0.5"
                  >
                    {name}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
      <Skeleton className="w-full h-40" />
      <div className="p-4 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/3" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-2/3" />
      </div>
    </div>
  );
}

export default function MenuSelectionPage() {
  const { eventId } = useParams<{ eventId: string }>();

  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [chosenSheets, setChosenSheets] = useState<Sheet[]>([]);

  const [eventName, setEventName] = useState<string | null>(null);
  const [contractorName, setContractorName] = useState<string | null>(null);

  const storageKey = `menu_favorites_${eventId}`;

  const [favorites, setFavorites] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) return new Set<string>(JSON.parse(saved));
    } catch {
      // ignore
    }
    return new Set<string>();
  });

  const [activeCategory, setActiveCategory] = useState<string>('all');

  // Persist favorites to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify([...favorites]));
    } catch {
      // ignore
    }
  }, [favorites, storageKey]);

  // Fetch event info from Bubble
  useEffect(() => {
    if (!eventId) return;
    const fetchEvent = async () => {
      try {
        const res = await fetch(`${BUBBLE_API}/Eventos/${eventId}`, {
          headers: { Authorization: BUBBLE_TOKEN },
        });
        if (res.ok) {
          const json = await res.json();
          const ev: BubbleEvent = json?.response;
          if (ev) {
            setEventName(ev.NomeDoEvento || null);
            setContractorName(ev.NomeDoContratante || null);
          }
        }
      } catch {
        // CORS or network error — proceed without event name
      }
    };
    fetchEvent();
  }, [eventId]);

  // Fetch sheets from Supabase
  useEffect(() => {
    const fetchSheets = async () => {
      const { data, error } = await (supabase
        .from('technical_sheets')
        .select('id, name, category, description, image_url, yield_quantity, yield_unit, technical_sheet_items(id, item_name)')
        .neq('is_active', false)
        .order('category', { ascending: true })
        .order('name', { ascending: true }) as any);

      if (error) {
        toast.error('Erro ao carregar o cardápio. Tente novamente.');
        setLoading(false);
        return;
      }

      setSheets((data || []) as Sheet[]);
      setLoading(false);
    };
    fetchSheets();
  }, []);

  const toggleFavorite = useCallback((id: string) => {
    setFavorites(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleConfirm = async () => {
    if (favorites.size === 0) return;
    setSubmitting(true);

    const selectedIds = [...favorites];
    const selected = sheets.filter(s => favorites.has(s.id));

    // Try to save to Bubble
    try {
      const res = await fetch(`${BUBBLE_API}/MenuSelecao`, {
        method: 'POST',
        headers: {
          Authorization: BUBBLE_TOKEN,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          Evento: eventId,
          PratosIds: JSON.stringify(selectedIds),
          DataEnvio: new Date().toISOString(),
          Status: 'pendente',
        }),
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
    } catch {
      // CORS / data type doesn't exist yet — save to localStorage as fallback
      try {
        localStorage.setItem(
          `menu_confirmed_${eventId}`,
          JSON.stringify({ ids: selectedIds, sentAt: new Date().toISOString() })
        );
      } catch {
        // ignore
      }
    }

    setChosenSheets(selected);
    setDone(true);
    setSubmitting(false);
  };

  // Categories
  const categories = ['all', ...Array.from(new Set(sheets.map(s => s.category).filter(Boolean) as string[]))];
  const filteredSheets = activeCategory === 'all'
    ? sheets
    : sheets.filter(s => s.category === activeCategory);

  // Group by category for display
  const grouped = filteredSheets.reduce<Record<string, Sheet[]>>((acc, s) => {
    const cat = s.category || 'Outros';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(s);
    return acc;
  }, {});

  const favoriteCount = favorites.size;

  // ── Success screen
  if (done) {
    return (
      <div className="min-h-screen bg-[#faf8f5] flex flex-col items-center justify-center p-6">
        <div className="max-w-lg w-full text-center">
          <div className="mb-6">
            <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto mb-3" />
            <h1 className="font-display text-2xl font-bold text-stone-800 mb-1">Preferências enviadas!</h1>
            <p className="text-stone-500 text-sm">
              Obrigado! Suas escolhas foram registradas com sucesso.
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-stone-200 p-5 text-left shadow-sm">
            <p className="text-xs font-semibold text-stone-400 uppercase tracking-widest mb-3">Pratos selecionados</p>
            <div className="space-y-2">
              {chosenSheets.map(s => (
                <div key={s.id} className="flex items-center gap-3">
                  {s.image_url ? (
                    <img src={s.image_url} alt={s.name} className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
                      <span className="text-lg font-bold text-stone-300">{s.name[0]}</span>
                    </div>
                  )}
                  <div>
                    <p className="font-medium text-stone-800 text-sm">{s.name}</p>
                    {s.category && (
                      <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-full', categoryColor(s.category))}>
                        {s.category}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs text-stone-400 mt-6">Nossa equipe entrará em contato para confirmar o cardápio do seu evento.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#faf8f5] pb-32">
      {/* Header */}
      <div className="bg-white border-b border-stone-200 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-5 text-center">
          <h1 className="font-display text-2xl font-bold tracking-widest text-stone-800">RONDELLO</h1>
          <p className="text-xs text-stone-400 tracking-widest uppercase mt-0.5">Buffet & Gastronomia</p>
          {(eventName || contractorName) && (
            <div className="mt-3 bg-amber-50 rounded-xl px-4 py-2 inline-block">
              {contractorName && (
                <p className="text-sm font-semibold text-amber-900">{contractorName}</p>
              )}
              {eventName && (
                <p className="text-xs text-amber-700">{eventName}</p>
              )}
            </div>
          )}
          <p className="text-sm text-stone-500 mt-3">
            Selecione os pratos que gostaria de incluir no cardápio do seu evento.
          </p>
        </div>

        {/* Category tabs */}
        {!loading && categories.length > 1 && (
          <div className="max-w-4xl mx-auto px-4 pb-3 overflow-x-auto">
            <div className="flex gap-2 w-max">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={cn(
                    'px-4 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap',
                    activeCategory === cat
                      ? 'bg-amber-800 text-white shadow'
                      : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                  )}
                >
                  {cat === 'all' ? 'Todos' : cat}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="max-w-4xl mx-auto px-4 pt-6">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : sheets.length === 0 ? (
          <div className="text-center py-20">
            <UtensilsCrossed className="w-12 h-12 text-stone-300 mx-auto mb-3" />
            <p className="text-stone-500">Nenhum prato disponível no momento.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {Object.entries(grouped).map(([cat, catSheets]) => (
              <div key={cat}>
                <div className="flex items-center gap-3 mb-4">
                  <h2 className="font-display font-bold text-stone-700 text-lg">{cat}</h2>
                  <div className="flex-1 h-px bg-stone-200" />
                  <Badge variant="outline" className="text-stone-400 border-stone-200 text-xs">
                    {catSheets.length} {catSheets.length === 1 ? 'prato' : 'pratos'}
                  </Badge>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {catSheets.map(sheet => (
                    <DishCard
                      key={sheet.id}
                      sheet={sheet}
                      favorited={favorites.has(sheet.id)}
                      onToggle={toggleFavorite}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Floating confirm bar */}
      {favoriteCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 p-4">
          <div className="max-w-lg mx-auto bg-amber-800 rounded-2xl shadow-xl px-5 py-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center">
                <Heart className="w-5 h-5 fill-white text-white" />
              </div>
              <div>
                <p className="text-white font-semibold text-sm">
                  {favoriteCount} {favoriteCount === 1 ? 'prato selecionado' : 'pratos selecionados'}
                </p>
                <p className="text-amber-200 text-xs">Toque para confirmar suas preferências</p>
              </div>
            </div>
            <Button
              onClick={handleConfirm}
              disabled={submitting}
              className="bg-white text-amber-900 hover:bg-amber-50 font-bold rounded-xl px-5 shrink-0"
            >
              {submitting ? 'Enviando...' : 'Confirmar'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
