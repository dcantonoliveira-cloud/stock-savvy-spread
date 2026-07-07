import { Calendar, MapPin, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Event } from '../types';
import { fmtDate, fmtRelative } from '../lib/format';
import { eventDisplayName, eventLocationName, statusLabel, statusBadgeClass } from '../lib/eventFilters';

interface Props {
  event: Event;
  showRelative?: boolean;
}

export default function EventCard({ event, showRelative }: Props) {
  const local = eventLocationName(event);
  return (
    <Link
      to={`/eventos/${event.id}`}
      className="block bg-white rounded-2xl border border-stone-200 p-4 shadow-sm active:bg-stone-50 transition-colors"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="font-bold text-stone-800 truncate text-[15px] flex-1 min-w-0">
          {eventDisplayName(event)}
        </p>
        <span className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${statusBadgeClass(event.status)}`}>
          {statusLabel(event.status)}
        </span>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-400 mt-1">
        {event.event_date && (
          <span className="flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 shrink-0" />
            {showRelative ? fmtRelative(event.event_date) : fmtDate(event.event_date)}
          </span>
        )}
        {local && (
          <span className="flex items-center gap-1 truncate max-w-[140px]">
            <MapPin className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{local}</span>
          </span>
        )}
        {event.guest_count != null && (
          <span className="flex items-center gap-1">
            <Users className="w-3.5 h-3.5 shrink-0" />
            {event.guest_count} conv.
          </span>
        )}
      </div>
    </Link>
  );
}
