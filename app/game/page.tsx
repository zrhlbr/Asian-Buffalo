import { permanentRedirect } from "next/navigation";

/**
 * Compat alias — redirects to canonical 《牛魔王》 play route.
 * Preserves old `/game` bookmarks; same GameClient via play shell.
 */
export default function GamePage() {
  permanentRedirect("/xi/bull-demon-king/play");
}
