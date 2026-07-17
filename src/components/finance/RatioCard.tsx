interface RatioCardProps {
  title: string;
  value: string;
  detail: string;
}

export function RatioCard({ title, value, detail }: RatioCardProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-sm font-medium text-slate-600">{title}</p>
      <p className="mt-3 text-xl font-semibold text-slate-900">{value}</p>
      <p className="mt-2 text-sm text-slate-600">{detail}</p>
    </div>
  );
}
