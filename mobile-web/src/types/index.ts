// Supabase data types for Rondello Buffet mobile app.

export interface Event {
  id: string;

  // Core
  event_name: string | null;
  event_date: string | null;
  status: string;               // 'confirmed' | 'completed' | 'lead' | 'negotiating' | 'lost' | 'cancelled'
  event_type: string | null;

  // Location
  location_id: string | null;
  location_text: string | null;
  event_locations?: { name: string } | null;

  // Guests
  guest_count: number | null;
  children_50_pct: number | null;
  non_paying_guests: number | null;
  guests_per_table: number | null;
  table_count: number | null;
  cake_table_location: string | null;
  additional_hours: number | null;

  // Financial
  total_value: number | null;
  paid_value: number | null;
  is_paid_in_full: boolean | null;

  // Ceremony
  ceremony_time: string | null;

  // Professionals
  professional_count: number | null;
  professional_meal_value: number | null;
  professional_meal_type: string | null;
  organizer: string | null;
  decorator: string | null;
  pastry_chef: string | null;
  band_dj: string | null;
  band_dj_time: string | null;
  photo_video: string | null;
  bartender: string | null;
  other_professionals: string | null;
  extra_attractions: string | null;

  // Setup
  welcome_cocktail: string | null;
  wine: string | null;
  whisky: string | null;
  beer: string | null;
  napkin_holder: string | null;
  tablecloth: string | null;
  rechaud: string | null;
  sousplat: string | null;
  sideboard: string | null;
  glass_type: string | null;
  bridal_suite: string | null;
  kids_area: string | null;

  // Notes
  notes: string | null;

  // Client
  client_id: string | null;
  clients?: { id: string; name: string; phone: string | null } | null;

  // Contract
  contract_signed_url: string | null;
}

export interface TastingSession {
  id: string;
  scheduled_date: string;
  type: string | null;
  max_couples: number | null;
  menu_text?: string | null;
  // from tasting_session_stats view
  total?: number | null;
  fechados?: number | null;
  // linked event count (from tasting_session_events)
  event_ids?: string[];
}

export interface TastingLead {
  id?: string;
  tasting_session_id: string;
  name: string;
  whatsapp: string;
  email: string | null;
  event_date: string | null;
  created_at?: string;
}

export interface EventPayment {
  id: string;
  payment_date: string | null;
  value: number;
  is_confirmed: boolean | null;
  type: string | null;
}
