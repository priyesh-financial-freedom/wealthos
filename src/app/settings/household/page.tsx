import { redirect } from "next/navigation";

export default function LegacyHouseholdRoutePage() {
  redirect("/settings/family");
}
