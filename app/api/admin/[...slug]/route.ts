/**
 * R1-M7 Admin console — catch-all API route.
 *
 * Delegates every /api/admin/* request to lib/admin/admin-api.ts. This file
 * is additive only; it does not touch any M1–M6 route.
 */

import { getDb } from "../../../../db/index.ts";
import { handleAdminApi } from "../../../../lib/admin/admin-api.ts";

type RouteContext = {
  params: Promise<{ slug?: string[] }>;
};

async function dispatch(request: Request, context: RouteContext): Promise<Response> {
  const db = await getDb();
  const { slug = [] } = await context.params;
  return handleAdminApi(db, request, slug);
}

export async function GET(request: Request, context: RouteContext) {
  return dispatch(request, context);
}

export async function POST(request: Request, context: RouteContext) {
  return dispatch(request, context);
}
