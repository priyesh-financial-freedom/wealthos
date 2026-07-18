interface ActivityItem {
  title: string;
  detail: string;
  time: string;
}

interface ActivityListProps {
  activities?: ActivityItem[];
}

const fallbackActivities = [
  { title: "Retirement contribution posted", detail: "$2,400 transferred to investment account", time: "12 min ago" },
  { title: "Cash balance updated", detail: "Operating account balance refreshed", time: "2 hrs ago" },
  { title: "Goal milestone reached", detail: "Emergency fund target increased by 6%", time: "Yesterday" },
];

export function ActivityList({ activities = fallbackActivities }: ActivityListProps) {
  return (
    <div className="space-y-4">
      {activities.map((item) => (
        <div key={`${item.title}-${item.time}`} className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3 last:border-none last:pb-0">
          <div>
            <p className="text-sm font-medium text-slate-900">{item.title}</p>
            <p className="mt-1 text-sm text-slate-600">{item.detail}</p>
          </div>
          <span className="shrink-0 text-xs text-slate-400">{item.time}</span>
        </div>
      ))}
    </div>
  );
}
