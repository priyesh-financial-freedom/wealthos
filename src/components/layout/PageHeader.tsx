interface PageHeaderProps {
  title: string;
  description: string;
  summary?: string;
}

export function PageHeader({ title, description, summary }: PageHeaderProps) {
  return (
    <div className="space-y-2">
      <h1 className="text-3xl font-semibold tracking-tight text-slate-900">{title}</h1>
      <p className="max-w-2xl text-sm text-slate-600 sm:text-base">{description}</p>
      {summary ? <p className="text-sm font-medium text-slate-700">{summary}</p> : null}
    </div>
  );
}
