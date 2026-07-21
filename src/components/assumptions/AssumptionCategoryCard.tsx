import { cn } from "@/lib/utils";
import type { AssumptionCategory } from "@/types/assumptions";

interface AssumptionCategoryCardProps {
  categories: AssumptionCategory[];
  selectedCategoryId: string | null;
  countsByCategoryId: Map<string, number>;
  onSelect: (categoryId: string) => void;
}

export function AssumptionCategoryCard({ categories, selectedCategoryId, countsByCategoryId, onSelect }: AssumptionCategoryCardProps) {
  return (
    <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/70">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Categories</h2>
      <div className="mt-3 grid gap-2">
        {categories.map((category) => {
          const active = category.id === selectedCategoryId;
          const count = countsByCategoryId.get(category.id) ?? 0;

          return (
            <button
              key={category.id}
              type="button"
              onClick={() => onSelect(category.id)}
              className={cn(
                "flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-sm transition",
                active
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-white",
              )}
            >
              <span className="font-medium">{category.name}</span>
              <span className={cn("rounded-md px-2 py-0.5 text-xs", active ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700")}>{count}</span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
