import Link from "next/link";
import { ChevronRight } from "lucide-react";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface PageBreadcrumbProps {
  items: BreadcrumbItem[];
}

export function PageBreadcrumb({ items }: PageBreadcrumbProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-2 overflow-x-auto text-sm text-slate-500">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <div key={`${item.label}:${index}`} className="flex items-center gap-2 whitespace-nowrap">
            {item.href && !isLast ? (
              <Link href={item.href} className="transition-colors hover:text-slate-900">
                {item.label}
              </Link>
            ) : (
              <span className={isLast ? "font-medium text-slate-900" : undefined}>{item.label}</span>
            )}
            {!isLast ? <ChevronRight className="h-4 w-4 text-slate-400" /> : null}
          </div>
        );
      })}
    </nav>
  );
}
