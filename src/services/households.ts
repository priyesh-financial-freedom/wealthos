import { supabase } from "@/lib/supabase/client";
import { CORE_FAMILY_MEMBERS } from "@/lib/family";
import type {
  Household,
  HouseholdDashboardSummary,
  HouseholdInsert,
  HouseholdMember,
  HouseholdMemberInsert,
  HouseholdMemberUpdate,
  HouseholdUpdate,
  HouseholdWithMembers,
  OwnershipType,
} from "@/types/household";

function assertSupabaseClient() {
  if (!supabase) {
    throw new Error("Supabase client is not configured.");
  }

  return supabase;
}

async function requireAuthenticatedUser() {
  const client = assertSupabaseClient();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();

  if (error || !user) {
    if (typeof window !== "undefined") {
      window.location.assign("/login");
    }

    throw new Error("Authentication required.");
  }

  return { client, user };
}

function normalizeMonthDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Invalid month value.");
  }

  return `${parsed.getUTCFullYear()}-${String(parsed.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

function normalizeCalendarDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Invalid date value.");
  }

  return parsed.toISOString().slice(0, 10);
}

function validateHouseholdInput(input: HouseholdInsert | HouseholdUpdate) {
  if (input.name !== undefined && !input.name.trim()) {
    throw new Error("Household name is mandatory.");
  }

  if (input.financial_year_start_month !== undefined) {
    if (input.financial_year_start_month < 1 || input.financial_year_start_month > 12) {
      throw new Error("Financial year start month must be between 1 and 12.");
    }
  }

  if (input.planning_start_month && input.planning_end_month) {
    const planningStart = new Date(normalizeMonthDate(input.planning_start_month));
    const planningEnd = new Date(normalizeMonthDate(input.planning_end_month));

    if (planningEnd <= planningStart) {
      throw new Error("Planning End Month must be after Planning Start Month.");
    }
  }
}

function mapHouseholdInsert(input: HouseholdInsert) {
  validateHouseholdInput(input);

  const planningStart = normalizeMonthDate(input.planning_start_month);
  const planningEnd = normalizeMonthDate(input.planning_end_month);

  if (new Date(planningEnd) <= new Date(planningStart)) {
    throw new Error("Planning End Month must be after Planning Start Month.");
  }

  return {
    name: input.name.trim(),
    base_currency: (input.base_currency ?? "INR").trim().toUpperCase(),
    financial_year_start_month: input.financial_year_start_month,
    planning_start_month: planningStart,
    planning_end_month: planningEnd,
  };
}

function mapHouseholdUpdate(input: HouseholdUpdate) {
  validateHouseholdInput(input);

  const updates: Record<string, unknown> = {};

  if (input.name !== undefined) {
    updates.name = input.name.trim();
  }

  if (input.base_currency !== undefined) {
    updates.base_currency = input.base_currency.trim().toUpperCase();
  }

  if (input.financial_year_start_month !== undefined) {
    updates.financial_year_start_month = input.financial_year_start_month;
  }

  if (input.planning_start_month !== undefined) {
    updates.planning_start_month = normalizeMonthDate(input.planning_start_month);
  }

  if (input.planning_end_month !== undefined) {
    updates.planning_end_month = normalizeMonthDate(input.planning_end_month);
  }

  const startValue = updates.planning_start_month;
  const endValue = updates.planning_end_month;
  if (typeof startValue === "string" && typeof endValue === "string") {
    if (new Date(endValue) <= new Date(startValue)) {
      throw new Error("Planning End Month must be after Planning Start Month.");
    }
  }

  return updates;
}

function mapMemberInsert(input: HouseholdMemberInsert) {
  if (!input.full_name?.trim()) {
    throw new Error("Member name is required.");
  }

  if (!input.relationship?.trim()) {
    throw new Error("Relationship is required.");
  }

  return {
    full_name: input.full_name.trim(),
    relationship: input.relationship.trim(),
    date_of_birth: input.date_of_birth ? normalizeCalendarDate(input.date_of_birth) : null,
    retirement_date: input.retirement_date ? normalizeCalendarDate(input.retirement_date) : null,
    employment_status: input.employment_status?.trim() || null,
    is_primary_user: Boolean(input.is_primary_user),
    is_active: input.is_active ?? true,
  };
}

function mapMemberUpdate(input: HouseholdMemberUpdate) {
  const updates: Record<string, unknown> = {};

  if (input.full_name !== undefined) {
    if (!input.full_name.trim()) {
      throw new Error("Member name is required.");
    }
    updates.full_name = input.full_name.trim();
  }

  if (input.relationship !== undefined) {
    if (!input.relationship.trim()) {
      throw new Error("Relationship is required.");
    }
    updates.relationship = input.relationship.trim();
  }

  if (input.date_of_birth !== undefined) {
    updates.date_of_birth = input.date_of_birth ? normalizeCalendarDate(input.date_of_birth) : null;
  }

  if (input.retirement_date !== undefined) {
    updates.retirement_date = input.retirement_date ? normalizeCalendarDate(input.retirement_date) : null;
  }

  if (input.employment_status !== undefined) {
    updates.employment_status = input.employment_status?.trim() || null;
  }

  if (input.is_primary_user !== undefined) {
    updates.is_primary_user = input.is_primary_user;
  }

  if (input.is_active !== undefined) {
    updates.is_active = input.is_active;
  }

  return updates;
}

function monthStartOffset(baseDate: Date, monthDelta: number) {
  return new Date(Date.UTC(baseDate.getUTCFullYear(), baseDate.getUTCMonth() + monthDelta, 1));
}

function computePlanningHorizonLabel(planningStartMonth: string, planningEndMonth: string) {
  const start = new Date(planningStartMonth);
  const end = new Date(planningEndMonth);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    return "Not set";
  }

  const monthDifference = (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + (end.getUTCMonth() - start.getUTCMonth());
  return `${monthDifference} months`;
}

function computeCurrentFinancialMonthLabel(financialYearStartMonth: number) {
  const now = new Date();
  const currentMonth = now.getUTCMonth() + 1;
  const normalizedStart = financialYearStartMonth >= 1 && financialYearStartMonth <= 12 ? financialYearStartMonth : 4;
  const financialMonthIndex = currentMonth >= normalizedStart ? currentMonth - normalizedStart + 1 : currentMonth + (12 - normalizedStart) + 1;
  const monthLabel = new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" }).format(now);

  return `FM${financialMonthIndex} (${monthLabel})`;
}

async function getHouseholdRecord(userId: string): Promise<Household | null> {
  const client = assertSupabaseClient();
  const { data, error } = await client.from("households").select("*").eq("user_id", userId).maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? null) as Household | null;
}

async function ensureCoreFamilyMembers(householdId: string) {
  const client = assertSupabaseClient();

  const { data: rows, error } = await client
    .from("household_members")
    .select("*")
    .eq("household_id", householdId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const members = (rows ?? []) as HouseholdMember[];
  const normalizedNameToMember = new Map(
    members.map((member) => [member.full_name.trim().toLowerCase(), member]),
  );

  const legacySelf = normalizedNameToMember.get("priyesh");
  const canonicalSelf = normalizedNameToMember.get("kumar priyesh");
  if (!canonicalSelf && legacySelf) {
    const { error: updateError } = await client
      .from("household_members")
      .update({
        full_name: "Kumar Priyesh",
        relationship: "Self",
        employment_status: "Employed",
        is_primary_user: true,
      })
      .eq("id", legacySelf.id)
      .eq("household_id", householdId);

    if (updateError) {
      throw new Error(updateError.message);
    }
  }

  for (const seed of CORE_FAMILY_MEMBERS) {
    const existingMember = normalizedNameToMember.get(seed.full_name.trim().toLowerCase());
    if (existingMember) {
      continue;
    }

    const { error: insertError } = await client.from("household_members").insert({
      household_id: householdId,
      full_name: seed.full_name,
      relationship: seed.relationship,
      employment_status: seed.employment_status,
      is_primary_user: seed.is_primary_user,
      is_active: true,
    });

    if (insertError) {
      throw new Error(insertError.message);
    }
  }

  const { data: activePrimaryRows, error: activePrimaryError } = await client
    .from("household_members")
    .select("id")
    .eq("household_id", householdId)
    .eq("is_active", true)
    .eq("is_primary_user", true);

  if (activePrimaryError) {
    throw new Error(activePrimaryError.message);
  }

  if (!activePrimaryRows || activePrimaryRows.length !== 1) {
    const { data: primaryMemberRows, error: primaryMemberError } = await client
      .from("household_members")
      .select("id")
      .eq("household_id", householdId)
      .eq("full_name", "Kumar Priyesh")
      .limit(1);

    if (primaryMemberError) {
      throw new Error(primaryMemberError.message);
    }

    const primaryMember = primaryMemberRows?.[0];
    if (primaryMember) {
      const { error: demoteError } = await client
        .from("household_members")
        .update({ is_primary_user: false })
        .eq("household_id", householdId)
        .eq("is_primary_user", true);

      if (demoteError) {
        throw new Error(demoteError.message);
      }

      const { error: promoteError } = await client
        .from("household_members")
        .update({ is_primary_user: true, is_active: true })
        .eq("id", primaryMember.id)
        .eq("household_id", householdId);

      if (promoteError) {
        throw new Error(promoteError.message);
      }
    }
  }
}

export async function ensureHouseholdInitialized(): Promise<HouseholdWithMembers> {
  const { user } = await requireAuthenticatedUser();
  const client = assertSupabaseClient();

  const existing = await getHouseholdRecord(user.id);
  if (existing) {
    await ensureCoreFamilyMembers(existing.id);
    const members = await listHouseholdMembers();
    return {
      household: existing,
      members,
    };
  }

  const now = new Date();
  const startMonth = monthStartOffset(now, 0);
  const endMonth = monthStartOffset(now, 60);

  const defaultHousehold = await createHousehold({
    name: "My Household",
    base_currency: "INR",
    financial_year_start_month: 4,
    planning_start_month: startMonth.toISOString(),
    planning_end_month: endMonth.toISOString(),
  });

  const priyesh = await addHouseholdMember({
    full_name: "Kumar Priyesh",
    relationship: "Self",
    employment_status: "Employed",
    is_primary_user: true,
    is_active: true,
  });

  await addHouseholdMember({
    full_name: "Shobhana",
    relationship: "Spouse",
    employment_status: "Homemaker",
    is_primary_user: false,
    is_active: true,
  });

  await addHouseholdMember({
    full_name: "Priyena Lal",
    relationship: "Daughter",
    employment_status: "Student",
    is_primary_user: false,
    is_active: true,
  });

  await addHouseholdMember({
    full_name: "Shobhit Lal",
    relationship: "Son",
    employment_status: "Student",
    is_primary_user: false,
    is_active: true,
  });

  const { data: latestMembers, error: membersError } = await client
    .from("household_members")
    .select("*")
    .eq("household_id", defaultHousehold.id)
    .order("is_primary_user", { ascending: false })
    .order("created_at", { ascending: true });

  if (membersError) {
    throw new Error(membersError.message);
  }

  const members = (latestMembers ?? []) as HouseholdMember[];
  if (!members.some((member) => member.id === priyesh.id && member.is_primary_user)) {
    throw new Error("Failed to initialize default household members.");
  }

  return {
    household: defaultHousehold,
    members,
  };
}

export async function createHousehold(input: HouseholdInsert): Promise<Household> {
  const { client, user } = await requireAuthenticatedUser();
  const existing = await getHouseholdRecord(user.id);

  if (existing) {
    throw new Error("A household already exists for this account.");
  }

  const payload = mapHouseholdInsert(input);

  const { data, error } = await client
    .from("households")
    .insert({
      user_id: user.id,
      ...payload,
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as Household;
}

export async function updateHousehold(input: HouseholdUpdate): Promise<Household> {
  const { client, user } = await requireAuthenticatedUser();
  const updates = mapHouseholdUpdate(input);

  const { data, error } = await client
    .from("households")
    .update(updates)
    .eq("id", input.id)
    .eq("user_id", user.id)
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as Household;
}

export async function getHousehold(): Promise<Household> {
  const { user } = await requireAuthenticatedUser();
  const household = await getHouseholdRecord(user.id);

  if (household) {
    return household;
  }

  const initialized = await ensureHouseholdInitialized();
  return initialized.household;
}

export async function listOwnershipTypes(): Promise<OwnershipType[]> {
  const { client } = await requireAuthenticatedUser();
  const { data, error } = await client.from("ownership_types").select("*").order("name", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as OwnershipType[];
}

export async function listHouseholdMembers(): Promise<HouseholdMember[]> {
  const { client } = await requireAuthenticatedUser();
  const household = await getHousehold();

  const { data, error } = await client
    .from("household_members")
    .select("*")
    .eq("household_id", household.id)
    .order("is_primary_user", { ascending: false })
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as HouseholdMember[];
}

function validatePrimaryUserInvariant(members: HouseholdMember[]) {
  const activeMembers = members.filter((member) => member.is_active);
  const primaryActiveMembers = activeMembers.filter((member) => member.is_primary_user);

  if (activeMembers.length === 0) {
    throw new Error("At least one active member is required.");
  }

  if (primaryActiveMembers.length !== 1) {
    throw new Error("There must always be exactly one Primary User.");
  }
}

export async function addHouseholdMember(input: HouseholdMemberInsert): Promise<HouseholdMember> {
  const { client } = await requireAuthenticatedUser();
  const household = await getHousehold();
  const currentMembers = await listHouseholdMembers();
  const payload = mapMemberInsert(input);

  const simulatedMembers: HouseholdMember[] = [
    ...currentMembers,
    {
      id: "new",
      household_id: household.id,
      full_name: payload.full_name,
      relationship: payload.relationship,
      date_of_birth: payload.date_of_birth,
      retirement_date: payload.retirement_date,
      employment_status: payload.employment_status,
      is_primary_user: payload.is_primary_user,
      is_active: payload.is_active,
      created_at: "",
      updated_at: "",
    },
  ];

  if (payload.is_primary_user && payload.is_active) {
    for (const member of simulatedMembers) {
      if (member.id !== "new") {
        member.is_primary_user = false;
      }
    }
  }

  validatePrimaryUserInvariant(simulatedMembers);

  if (payload.is_primary_user && payload.is_active) {
    const { error: clearPrimaryError } = await client
      .from("household_members")
      .update({ is_primary_user: false })
      .eq("household_id", household.id)
      .eq("is_primary_user", true);

    if (clearPrimaryError) {
      throw new Error(clearPrimaryError.message);
    }
  }

  const { data, error } = await client
    .from("household_members")
    .insert({
      household_id: household.id,
      ...payload,
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as HouseholdMember;
}

export async function updateHouseholdMember(input: HouseholdMemberUpdate): Promise<HouseholdMember> {
  const { client } = await requireAuthenticatedUser();
  const household = await getHousehold();
  const currentMembers = await listHouseholdMembers();
  const currentMember = currentMembers.find((member) => member.id === input.id);

  if (!currentMember) {
    throw new Error("Household member not found.");
  }

  const updates = mapMemberUpdate(input);
  const mergedMember: HouseholdMember = {
    ...currentMember,
    ...updates,
  } as HouseholdMember;

  const simulatedMembers = currentMembers.map((member) => (member.id === input.id ? mergedMember : { ...member }));

  if (mergedMember.is_primary_user && mergedMember.is_active) {
    for (const member of simulatedMembers) {
      if (member.id !== input.id) {
        member.is_primary_user = false;
      }
    }
  }

  validatePrimaryUserInvariant(simulatedMembers);

  if (mergedMember.is_primary_user && mergedMember.is_active) {
    const { error: clearPrimaryError } = await client
      .from("household_members")
      .update({ is_primary_user: false })
      .eq("household_id", household.id)
      .neq("id", input.id)
      .eq("is_primary_user", true);

    if (clearPrimaryError) {
      throw new Error(clearPrimaryError.message);
    }
  }

  const { data, error } = await client
    .from("household_members")
    .update(updates)
    .eq("id", input.id)
    .eq("household_id", household.id)
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as HouseholdMember;
}

export async function deleteHouseholdMember(id: string): Promise<void> {
  const { client } = await requireAuthenticatedUser();
  const household = await getHousehold();
  const members = await listHouseholdMembers();
  const targetMember = members.find((member) => member.id === id);

  if (!targetMember) {
    throw new Error("Household member not found.");
  }

  const activeMembers = members.filter((member) => member.is_active);
  if (targetMember.is_active && activeMembers.length <= 1) {
    throw new Error("Cannot delete the last active member.");
  }

  if (targetMember.is_primary_user) {
    const fallbackPrimary = members.find((member) => member.id !== id && member.is_active);
    if (!fallbackPrimary) {
      throw new Error("There must always be exactly one Primary User.");
    }

    const { error: promoteError } = await client
      .from("household_members")
      .update({ is_primary_user: true })
      .eq("id", fallbackPrimary.id)
      .eq("household_id", household.id);

    if (promoteError) {
      throw new Error(promoteError.message);
    }
  }

  const { error } = await client.from("household_members").delete().eq("id", id).eq("household_id", household.id);

  if (error) {
    throw new Error(error.message);
  }
}

export async function getHouseholdWithMembers(): Promise<HouseholdWithMembers> {
  const initialized = await ensureHouseholdInitialized();

  return {
    household: initialized.household,
    members: initialized.members,
  };
}

export async function getHouseholdDashboardSummary(): Promise<HouseholdDashboardSummary | null> {
  const initialized = await ensureHouseholdInitialized();
  const household = initialized.household;
  const members = initialized.members;

  return {
    householdName: household.name,
    membersCount: members.filter((member) => member.is_active).length,
    planningHorizonLabel: computePlanningHorizonLabel(household.planning_start_month, household.planning_end_month),
    currentFinancialMonthLabel: computeCurrentFinancialMonthLabel(household.financial_year_start_month),
  };
}
