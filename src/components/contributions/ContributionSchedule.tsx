import { formatCurrency } from "@/lib/formatters";
import type { ContributionPreviewItem } from "@/types/contributionPolicy";

interface ContributionScheduleProps {
  items: ContributionPreviewItem[];
}

export function ContributionSchedule({ items }: ContributionScheduleProps) {
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-600">
        No contributions in this preview horizon.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-3 py-2 text-left font-medium text-slate-600">#</th>
            <th className="px-3 py-2 text-left font-medium text-slate-600">Date</th>
            <th className="px-3 py-2 text-right font-medium text-slate-600">Base</th>
            <th className="px-3 py-2 text-right font-medium text-slate-600">Growth</th>
            <th className="px-3 py-2 text-right font-medium text-slate-600">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {items.map((item) => (
            <tr key={`${item.contributionDate}-${item.index}`}>
              <td className="px-3 py-2 text-slate-700">{item.index}</td>
              <td className="px-3 py-2 text-slate-700">{item.contributionDate}</td>
              <td className="px-3 py-2 text-right text-slate-900">{formatCurrency(item.baseAmount, { maximumFractionDigits: 0 })}</td>
              <td className="px-3 py-2 text-right text-emerald-700">{formatCurrency(item.growthAmount, { maximumFractionDigits: 0 })}</td>
              <td className="px-3 py-2 text-right font-semibold text-slate-900">{formatCurrency(item.totalAmount, { maximumFractionDigits: 0 })}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
