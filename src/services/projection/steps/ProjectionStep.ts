import type { ProjectionContext } from "@/services/projection/ProjectionContext";

export interface ProjectionStep {
  readonly id: string;
  execute(context: ProjectionContext): ProjectionContext | Promise<ProjectionContext>;
}