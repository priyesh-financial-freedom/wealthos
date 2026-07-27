import { CalendarClock } from "lucide-react";

import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { formatCurrency, formatDate } from "@/lib/formatters";

interface UpcomingItem {
  id: string;
  name: string;
  date: string;
  amount: number;
  module: string;
  type: string;
}

interface UpcomingWidgetProps {
  available: boolean;
  items: UpcomingItem[];
}

export function UpcomingWidget({ available, items }: UpcomingWidgetProps) {
  return (
    <DashboardCard className="h-full">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-slate-500">What&apos;s Coming Up</p>
          <h3 className="mt-2 text-xl font-semibold text-slate-900">Upcoming Financial Events</h3>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-100 text-cyan-700">
          <CalendarClock className="h-5 w-5" />
        </div>
      </div>

      {!available ? (
        <ComingSoon />
      ) : items.length === 0 ? (
        <p className="mt-6 rounded-2xl bg-slate-50 px-4 py-6 text-sm text-slate-600">No upcoming events scheduled.</p>
      ) : (
        <div className="mt-5 space-y-3">
          {items.map((item) => (
            <article key={item.id} className="rounded-2xl bg-slate-50 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-slate-900">{item.name}</p>
                <p className="text-sm font-semibold text-slate-900">{formatCurrency(item.amount, { maximumFractionDigits: 0 })}</p>
              </div>
              <p className="mt-1 text-xs text-slate-600">
                {formatDate(item.date)} · {item.module} · {item.type}
              </p>
            </article>
          ))}
        </div>
      )}
    </DashboardCard>
  );
}

function ComingSoon() {
  return <p className="mt-6 rounded-2xl bg-slate-50 px-4 py-6 text-sm text-slate-600">Coming Soon</p>;
}
