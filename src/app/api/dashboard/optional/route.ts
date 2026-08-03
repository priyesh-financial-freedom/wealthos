import { NextResponse } from "next/server";

import { executiveDashboardService } from "@/services/dashboard";

export async function GET() {
  const data = await executiveDashboardService.getDashboardOptional();
  return NextResponse.json(data);
}