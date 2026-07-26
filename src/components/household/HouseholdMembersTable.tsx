import { Eye, Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DataGrid } from "@/components/ui/data-grid";
import type { HouseholdMember } from "@/types/household";

interface HouseholdMembersTableProps {
  members: HouseholdMember[];
  onView: (member: HouseholdMember) => void;
  onEdit: (member: HouseholdMember) => void;
  onDelete: (member: HouseholdMember) => void;
}

function statusLabel(value: boolean) {
  return value ? "Active" : "Inactive";
}

export function HouseholdMembersTable({ members, onView, onEdit, onDelete }: HouseholdMembersTableProps) {
  return (
    <DataGrid
      title="Family Members"
      description="Manage family members and owner roles"
      columns={[
        {
          key: "full_name",
          header: "Name",
          widthClassName: "min-w-44",
          className: "font-medium text-slate-900",
          cell: (member) => member.full_name,
        },
        {
          key: "relationship",
          header: "Relationship",
          widthClassName: "min-w-32",
          cell: (member) => member.relationship,
        },
        {
          key: "employment_status",
          header: "Employment Status",
          widthClassName: "min-w-36",
          cell: (member) => member.employment_status || "—",
        },
        {
          key: "is_primary_user",
          header: "Owner",
          widthClassName: "min-w-28",
          cell: (member) => (member.is_primary_user ? "Primary" : "Member"),
        },
        {
          key: "is_active",
          header: "Status",
          widthClassName: "min-w-28",
          cell: (member) => statusLabel(member.is_active),
        },
        {
          key: "actions",
          header: "Actions",
          widthClassName: "min-w-32",
          className: "text-right",
          headerClassName: "text-right",
          cell: (member) => (
            <div className="flex items-center justify-end gap-2" onClick={(event) => event.stopPropagation()}>
              <Button type="button" variant="ghost" size="icon" onClick={() => onView(member)}>
                <Eye className="h-4 w-4" />
              </Button>
              <Button type="button" variant="ghost" size="icon" onClick={() => onEdit(member)}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button type="button" variant="ghost" size="icon" onClick={() => onDelete(member)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ),
        },
      ]}
      rows={members}
      getRowId={(member) => member.id}
      onRowClick={onView}
      emptyTitle="No family members found"
      emptyDescription="Add family members to personalize planning and owner context."
      selection={{ enabled: false }}
    />
  );
}
