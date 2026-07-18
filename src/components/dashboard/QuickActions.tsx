import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

const actions = [
  { label: "Add Asset", href: "/assets", icon: Plus },
  { label: "Add Liability", href: "/liabilities", icon: Plus },
];

export function QuickActions() {
  return (
    <div className="flex flex-wrap gap-3">
      {actions.map((action) => {
        const Icon = action.icon;
        return (
          <Button key={action.label} variant="outline" className="gap-2" asChild>
            <Link href={action.href}>
              <Icon className="h-4 w-4" />
              {action.label}
            </Link>
          </Button>
        );
      })}
    </div>
  );
}
