import { getDb } from "../../../../../../db/index.ts";
import {
  createProductionIdentityProvider,
  handleGetRound,
} from "../../../../../../lib/api-handlers.ts";

const identityProvider = createProductionIdentityProvider();

export async function GET(
  request: Request,
  { params }: { params: Promise<{ roundId: string }> },
) {
  const db = await getDb();
  const { roundId } = await params;
  return handleGetRound(db, { identityProvider, request }, roundId);
}
