
// DEPRECATED: Use getUnifiedDashboardData from unified-fetcher.ts instead
// This file is kept for backward compatibility only

import { getUnifiedDashboardData } from "@/lib/data/unified-fetcher";

export async function getSafeDashboardData() {
  console.warn("getSafeDashboardData is deprecated. Use getUnifiedDashboardData instead.");
  return getUnifiedDashboardData();
}
