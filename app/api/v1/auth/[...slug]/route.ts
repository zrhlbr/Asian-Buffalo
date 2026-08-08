/**
 * Player Auth API catch-all — /api/v1/auth/*
 */
import { handlePlayerAuthApi } from "../../../../../lib/player-auth-api.ts";

export async function GET(request: Request) {
  return handlePlayerAuthApi(request);
}

export async function POST(request: Request) {
  return handlePlayerAuthApi(request);
}
