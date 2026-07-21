export type HealthScoreComponentKey =
  | "liquidity"
  | "debt"
  | "goals"
  | "retirement"
  | "diversification"
  | "emergencyFund";

export interface HealthScoreWeights {
  liquidity: number;
  debt: number;
  goals: number;
  retirement: number;
  diversification: number;
  emergencyFund: number;
}

export interface HealthScoreComponent {
  key: HealthScoreComponentKey;
  label: string;
  weight: number;
  score: number;
  weightedScore: number;
  detail: string;
}

export interface HealthScoreTrendPoint {
  month: string;
  score: number;
}

export interface HealthScore {
  overallScore: number;
  grade: "A+" | "A" | "B" | "C" | "Needs Attention";
  components: HealthScoreComponent[];
  strengths: string[];
  watchItems: string[];
  recommendations: string[];
  trend: HealthScoreTrendPoint[];
}
