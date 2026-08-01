export const OWNERSHIP_OPTIONS = ["Priyesh", "Shobhana", "Joint"] as const;

export const GOAL_BENEFICIARY_OPTIONS = ["Priyesh + Shobhana", "Priyena Lal", "Shobhit Lal"] as const;

export interface CoreFamilyMemberSeed {
  full_name: string;
  relationship: "Self" | "Spouse" | "Daughter" | "Son";
  employment_status: "Employed" | "Homemaker" | "Student";
  is_primary_user: boolean;
}

export const CORE_FAMILY_MEMBERS: CoreFamilyMemberSeed[] = [
  {
    full_name: "Kumar Priyesh",
    relationship: "Self",
    employment_status: "Employed",
    is_primary_user: true,
  },
  {
    full_name: "Shobhana",
    relationship: "Spouse",
    employment_status: "Homemaker",
    is_primary_user: false,
  },
  {
    full_name: "Priyena Lal",
    relationship: "Daughter",
    employment_status: "Student",
    is_primary_user: false,
  },
  {
    full_name: "Shobhit Lal",
    relationship: "Son",
    employment_status: "Student",
    is_primary_user: false,
  },
];
