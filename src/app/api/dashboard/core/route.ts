import { NextResponse } from "next/server";

import { executiveDashboardService } from "@/services/dashboard";

export async function GET() {
  const data = await executiveDashboardService.getDashboardCore();
  return NextResponse.json(data);
}