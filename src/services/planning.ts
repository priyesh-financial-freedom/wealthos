export interface PlanningDashboardSummary {
  hero: {
    title: string;
    subtitle: string;
    recommendedNextAction: string;
  };
  stats: {
    scenarios: number;
    goals: number;
    retirementStatus: string;
    cashFlowStatus: string;
  };
  modules: Array<{
    id: string;
    title: string;
    description: string;
    status: string;
    actionLabel: string;
    actionHref: string;
    icon: string;
  }>;
  recentActivity: Array<{
    id: string;
    title: string;
    date: string;
    description: string;
  }>;
}

const planningDashboardMockSummary: PlanningDashboardSummary = {
  hero: {
    title: "Planning",
    subtitle: "Model your financial future before making important financial decisions.",
    recommendedNextAction: "Create your first scenario.",
  },
  stats: {
    scenarios: 0,
    goals: 0,
    retirementStatus: "Not Planned",
    cashFlowStatus: "Not Configured",
  },
  modules: [
    {
      id: "scenarios",
      title: "Scenarios",
      description: "Organize assumptions and compare future paths before you commit.",
      status: "No scenarios created",
      actionLabel: "Manage scenarios",
      actionHref: "/planning/scenarios",
      icon: "FolderKanban",
    },
    {
      id: "goals",
      title: "Goals",
      description: "Track milestones and align your plans with meaningful targets.",
      status: "No goals defined",
      actionLabel: "Review goals",
      actionHref: "/planning/goals",
      icon: "Target",
    },
    {
      id: "retirement",
      title: "Retirement",
      description: "Map contributions, timelines, and long-term readiness in one view.",
      status: "Not configured",
      actionLabel: "Open planner",
      actionHref: "/planning/retirement",
      icon: "PiggyBank",
    },
    {
      id: "cashflow",
      title: "Cash Flow",
      description: "Understand inflows, outflows, and timing before they become constraints.",
      status: "Awaiting setup",
      actionLabel: "Inspect cash flow",
      actionHref: "/planning/cashflow",
      icon: "ArrowRightLeft",
    },
    {
      id: "events",
      title: "Financial Events",
      description: "Capture recurring or one-time planning events that drive future outcomes.",
      status: "View financial events",
      actionLabel: "View events",
      actionHref: "/planning/events",
      icon: "CalendarClock",
    },
  ],
  recentActivity: [],
};

export const PlanningDashboardService = {
  async getSummary(): Promise<PlanningDashboardSummary> {
    return planningDashboardMockSummary;
  },
};
