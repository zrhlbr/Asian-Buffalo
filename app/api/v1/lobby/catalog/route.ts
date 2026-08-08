/**
 * Additive lobby catalog API — Phase 1 static seed.
 * Fail-open for unauthenticated catalog read (no wallet secrets).
 */
import { getLobbyCatalog } from "../../../../../lib/lobby-catalog.ts";

export async function GET() {
  return Response.json(getLobbyCatalog(), {
    headers: {
      "Cache-Control": "public, max-age=30",
    },
  });
}
