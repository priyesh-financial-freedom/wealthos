import { CalendarClock } from "lucide-react";

import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { WidgetComingSoon, WidgetHeader } from "@/components/dashboard/WidgetPrimitives";
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
    <DashboardCard>
      <WidgetHeader eyebrow="What&apos;s coming up" title="Upcoming financial events" icon={CalendarClock} iconTone="cyan" />

      {!available ? (
        <WidgetComingSoon />
      ) : items.length === 0 ? (
        <WidgetComingSoon text="No upcoming events scheduled." />
      ) : (
        <div className="mt-6 space-y-3">
          {items.map((item) => (
            <article key={item.id} className="rounded-2xl bg-slate-50 px-4 py-3.5">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-semibold leading-5 text-slate-900">{item.name}</p>
                <p className="text-sm font-semibold text-slate-900">{formatCurrency(item.amount, { maximumFractionDigits: 0 })}</p>
              </div>
              <p className="mt-1.5 text-xs text-slate-600">
                {formatDate(item.date)} · <span className="capitalize">{item.module}</span> · <span className="capitalize">{item.type}</span>
              </p>
            </article>
          ))}
        </div>
      )}
    </DashboardCard>
  );
}
