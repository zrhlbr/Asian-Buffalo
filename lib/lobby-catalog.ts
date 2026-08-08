/**
 * XI GAME lobby catalog — static seed for Phase 1.
 * Admin authoring (M9) deferred; schema stable for future PATCH.
 */

export type LobbyGameStatus = "live" | "coming_soon";

export type LobbyBadge = "hot" | "new" | "jackpot" | "recommended";

export interface LobbyGameCard {
  id: string;
  /** i18n key under lobby.games.<id>.* */
  titleKey: string;
  status: LobbyGameStatus;
  badges: LobbyBadge[];
  /** Shown only when status === live; otherwise ignored */
  href?: string;
  multiplierLabel?: string;
  playersOnline?: number | null;
  jackpotMinor?: number | null;
  category: "recommended" | "slots" | "myth" | "jackpot";
}

export interface LobbyCatalogResponse {
  version: string;
  platform: {
    brandKey: string;
    heroAsset: "placeholder" | "provided";
  };
  categories: Array<{ id: string; labelKey: string }>;
  games: LobbyGameCard[];
}

export const LOBBY_CATALOG_VERSION = "xi-lobby-v1";

export function getLobbyCatalog(): LobbyCatalogResponse {
  return {
    version: LOBBY_CATALOG_VERSION,
    platform: {
      brandKey: "lobby.brand",
      heroAsset: "placeholder",
    },
    categories: [
      { id: "recommended", labelKey: "lobby.cat.recommended" },
      { id: "hot", labelKey: "lobby.cat.hot" },
      { id: "new", labelKey: "lobby.cat.new" },
      { id: "jackpot", labelKey: "lobby.cat.jackpot" },
      { id: "slots", labelKey: "lobby.cat.slots" },
    ],
    games: [
      {
        id: "bdk",
        titleKey: "lobby.games.bdk.title",
        status: "live",
        badges: ["hot", "recommended", "jackpot"],
        href: "/xi/bull-demon-king",
        multiplierLabel: "x5000",
        playersOnline: null,
        jackpotMinor: null,
        category: "recommended",
      },
      {
        id: "wukong",
        titleKey: "lobby.games.wukong.title",
        status: "coming_soon",
        badges: ["new"],
        category: "myth",
      },
      {
        id: "nezha",
        titleKey: "lobby.games.nezha.title",
        status: "coming_soon",
        badges: ["new"],
        category: "myth",
      },
      {
        id: "dragonking",
        titleKey: "lobby.games.dragonking.title",
        status: "coming_soon",
        badges: ["recommended"],
        category: "myth",
      },
      {
        id: "redboy",
        titleKey: "lobby.games.redboy.title",
        status: "coming_soon",
        badges: ["hot"],
        category: "myth",
      },
      {
        id: "bonespirit",
        titleKey: "lobby.games.bonespirit.title",
        status: "coming_soon",
        badges: ["new"],
        category: "myth",
      },
    ],
  };
}
