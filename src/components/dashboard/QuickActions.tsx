import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

const actions = [
  { label: "Add Asset", icon: Plus },
  { label: "Add Liability", icon: Plus },
  { label: "Add Investment", icon: Plus },
  { label: "Add Goal", icon: Plus },
];

export function QuickActions() {
  return (
    <div className="flex flex-wrap gap-3">
      {actions.map((action) => {
        const Icon = action.icon;
        return (
          <Button key={action.label} variant="outline" className="gap-2">
            <Icon className="h-4 w-4" />
            {action.label}
          </Button>
        );
      })}
    </div>
  );
}
