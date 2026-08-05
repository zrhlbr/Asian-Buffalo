import { getDb } from "../../../../../db/index.ts";
import { handleCreateSession } from "../../../../../lib/api-handlers.ts";

export async function POST(request: Request) {
  const db = await getDb();
  const payload = await request.json().catch(() => null);
  return handleCreateSession(db, payload);
}
