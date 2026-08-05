import { getDb } from "../../../../../../db/index.ts";
import { handleGetRound } from "../../../../../../lib/api-handlers.ts";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ roundId: string }> },
) {
  const db = await getDb();
  const { roundId } = await params;
  return handleGetRound(db, roundId);
}
