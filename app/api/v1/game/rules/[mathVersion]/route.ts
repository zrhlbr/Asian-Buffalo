import { getDb } from "../../../../../../db/index.ts";
import { handleGetRules } from "../../../../../../lib/api-handlers.ts";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ mathVersion: string }> },
) {
  const db = await getDb();
  const { mathVersion } = await params;
  return handleGetRules(db, mathVersion);
}
