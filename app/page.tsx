import { permanentRedirect } from "next/navigation";

/**
 * Compat redirect — canonical formal play is `/xi/bull-demon-king/play`.
 * Single GameClient stack (mounted by play shell); no second formal game stack.
 */
export default function Home() {
  permanentRedirect("/xi/bull-demon-king/play");
}
