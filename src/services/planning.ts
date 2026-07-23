import { goalService } from "@/services/planning/goals";
import { planningScenarioService } from "@/services/planning/scenarios";

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

function buildBaseSummary(): PlanningDashboardSummary {
	return {
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
			{
				id: "contribution-policies",
				title: "Contribution Policies",
				description: "Define reusable recurring contribution rules for long-term investing and policy-based execution.",
				status: "Policy engine ready",
				actionLabel: "Manage policies",
				actionHref: "/planning/contribution-policies",
				icon: "Repeat",
			},
			{
				id: "decision-center",
				title: "Decision Center",
				description: "Generate deterministic recommendations using simulation and health outputs.",
				status: "Rule engine ready",
				actionLabel: "Open decision center",
				actionHref: "/planning/decision-center",
				icon: "Sparkles",
			},
		],
		recentActivity: [],
	};
}

function buildRecommendedNextAction(scenariosCount: number, goalsCount: number): string {
	if (scenariosCount === 0) {
		return "Create your first scenario.";
	}

	if (goalsCount === 0) {
		return "Create your first goal.";
	}

	return "Run a scenario comparison.";
}

export const PlanningDashboardService = {
	getInitialSummary(): PlanningDashboardSummary {
		return buildBaseSummary();
	},

	async getSummary(): Promise<PlanningDashboardSummary> {
		const summary = buildBaseSummary();

		const [goalsResult, scenariosResult] = await Promise.allSettled([
			goalService.listGoals({ includeProgress: true }),
			planningScenarioService.listScenarios(),
		]);

		const goals = goalsResult.status === "fulfilled" ? goalsResult.value : [];
		const scenarios = scenariosResult.status === "fulfilled" ? scenariosResult.value : [];

		summary.stats.goals = goals.length;
		summary.stats.scenarios = scenarios.length;
		summary.hero.recommendedNextAction = buildRecommendedNextAction(scenarios.length, goals.length);

		summary.modules = summary.modules.map((module) => {
			if (module.id === "goals") {
				return {
					...module,
					status: goals.length > 0 ? `${goals.length} goal${goals.length === 1 ? "" : "s"} defined` : "No goals defined",
				};
			}

			if (module.id === "scenarios") {
				return {
					...module,
					status: scenarios.length > 0 ? `${scenarios.length} scenario${scenarios.length === 1 ? "" : "s"} created` : "No scenarios created",
				};
			}

			return module;
		});

		return summary;
	},
};
