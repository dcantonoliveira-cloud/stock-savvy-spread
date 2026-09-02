import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Calendar, MapPin, Users, Loader2 } from 'lucide-react';
import SheetPickerStep from '@/components/menu-wizard/SheetPickerStep';
import QuantitiesStep from '@/components/menu-wizard/QuantitiesStep';
import ShoppingListStep from '@/components/menu-wizard/ShoppingListStep';

type MenuData = {
  id: string; event_id: string | null; status: string; wizard_step: number;
  name: string | null; location: string | null; event_date: string | null; guest_count: number | null;
  events: { event_name: string; event_date: string; location_text: string | null; guest_count: number | null } | null;
};

const STEPS = [
  { n: 1, label: 'Pratos' },
  { n: 2, label: 'Quantidades' },
  { n: 3, label: 'Compras' },
];

export default function EventMenuDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [menu, setMenu] = useState<MenuData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeStep, setActiveStep] = useState(1);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    const { data } = await (supabase.from('event_menus') as any)
      .select('id, event_id, status, wizard_step, name, location, event_date, guest_count, events:event_id(event_name, event_date, location_text, guest_count)')
      .eq('id', id).single();
    if (data) {
      setMenu(data as MenuData);
      setActiveStep(Math.min(3, Math.max(1, data.wizard_step || 1)));
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [id]);

  const advanceTo = async (step: number) => {
    if (!menu) return;
    if (step > (menu.wizard_step || 1)) {
      const updates: any = { wizard_step: step };
      if (step >= 3) updates.status = 'ready';
      await supabase.from('event_menus').update(updates).eq('id', menu.id);
      setMenu(prev => prev ? { ...prev, wizard_step: step, status: step >= 3 ? 'ready' : prev.status } : prev);
    }
    setActiveStep(step);
  };

  if (loading || !menu) {
    return <div className="flex items-center justify-center py-24"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>;
  }

  const name = menu.events?.event_name || menu.name || 'Cardápio';
  const date = menu.events?.event_date || menu.event_date;
  const location = menu.events?.location_text || menu.location;
  const guests = menu.events?.guest_count ?? menu.guest_count;
  const unlockedStep = menu.wizard_step || 1;

  return (
    <div>
      <Button variant="ghost" size="sm" className="mb-3 -ml-2" onClick={() => navigate('/event-menus')}>
        <ArrowLeft className="w-4 h-4 mr-1.5" />Voltar
      </Button>

      <div className="mb-6">
        <h1 className="text-2xl font-display font-bold text-foreground">{name}</h1>
        <div className="flex items-center gap-4 mt-1.5 text-sm text-muted-foreground flex-wrap">
          {date && <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" />{new Date(date + 'T12:00:00').toLocaleDateString('pt-BR')}</span>}
          {location && <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" />{location}</span>}
          {guests != null && <span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5" />{guests} convidados</span>}
        </div>
      </div>

      <div className="flex items-center gap-2 mb-6">
        {STEPS.map(({ n, label }) => {
          const unlocked = n <= unlockedStep;
          return (
            <div key={n} className="flex items-center gap-2 flex-1">
              <button
                disabled={!unlocked}
                onClick={() => unlocked && setActiveStep(n)}
                className={`flex items-center gap-1.5 text-xs font-medium ${activeStep === n ? 'text-primary' : unlocked ? 'text-foreground hover:text-primary' : 'text-muted-foreground/50 cursor-not-allowed'}`}
              >
                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${activeStep === n ? 'bg-primary text-white' : unlocked ? 'bg-muted text-foreground' : 'bg-muted/50 text-muted-foreground/50'}`}>{n}</div>
                {label}
              </button>
              {n < STEPS.length && <div className={`flex-1 h-px ${unlockedStep > n ? 'bg-primary' : 'bg-border'}`} />}
            </div>
          );
        })}
      </div>

      <div className="bg-white border border-border rounded-2xl p-6">
        {activeStep === 1 && <SheetPickerStep menuId={menu.id} onContinue={() => advanceTo(2)} />}
        {activeStep === 2 && <QuantitiesStep menuId={menu.id} onContinue={() => advanceTo(3)} onBack={() => setActiveStep(1)} />}
        {activeStep === 3 && <ShoppingListStep menuId={menu.id} onBack={() => setActiveStep(2)} />}
      </div>
    </div>
  );
}
