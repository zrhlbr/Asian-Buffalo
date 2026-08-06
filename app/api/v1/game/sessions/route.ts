import { getDb } from "../../../../../db/index.ts";
import {
  createProductionIdentityProvider,
  handleCreateSession,
} from "../../../../../lib/api-handlers.ts";

const identityProvider = createProductionIdentityProvider();

export async function POST(request: Request) {
  const db = await getDb();
  const payload = await request.json().catch(() => null);
  return handleCreateSession(db, { identityProvider, request }, payload);
}
