import { Calendar, MapPin, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { BubbleEvento } from '../types';
import StatusBadge from './StatusBadge';
import { fmtDate, fmtRelative } from '../lib/format';

interface Props {
  event: BubbleEvento;
  showRelative?: boolean;
}

export default function EventCard({ event, showRelative }: Props) {
  return (
    <Link
      to={`/eventos/${event._id}`}
      className="block bg-white rounded-2xl border border-stone-200 p-4 shadow-sm active:bg-stone-50 transition-colors"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <p className="font-bold text-stone-800 truncate text-[15px]">
            {event.NomeDoContratante ?? '—'}
          </p>
          {event.NomeDoEvento && (
            <p className="text-sm text-stone-500 truncate">{event.NomeDoEvento}</p>
          )}
        </div>
        <StatusBadge status={event.Status} />
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-400 mt-1">
        {event.dataDoEvento && (
          <span className="flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 shrink-0" />
            {showRelative
              ? fmtRelative(event.dataDoEvento)
              : fmtDate(event.dataDoEvento)}
          </span>
        )}
        {event.Local && (
          <span className="flex items-center gap-1 truncate max-w-[140px]">
            <MapPin className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{event.Local}</span>
          </span>
        )}
        {event.NumeroDeConvidados != null && (
          <span className="flex items-center gap-1">
            <Users className="w-3.5 h-3.5 shrink-0" />
            {event.NumeroDeConvidados} conv.
          </span>
        )}
      </div>
    </Link>
  );
}
