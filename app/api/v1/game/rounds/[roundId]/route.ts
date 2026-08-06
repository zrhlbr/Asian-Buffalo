import { getDb } from "../../../../../../db/index.ts";
import {
  createProductionIdentityProvider,
  handleGetRound,
} from "../../../../../../lib/api-handlers.ts";
import { createRuntimeIdentityProvider } from "../../../../../../lib/runtime-identity.ts";

/**
 * Round recovery/read for M5 presentation. Same explicit identity gate.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ roundId: string }> },
) {
  void createProductionIdentityProvider;
  const db = await getDb();
  const identityProvider = createRuntimeIdentityProvider();
  const { roundId } = await params;
  return handleGetRound(db, { identityProvider, request }, roundId);
}
