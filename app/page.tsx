import { permanentRedirect } from "next/navigation";

/**
 * Root → 《西游戏》Lobby. Play remains at `/xi/bull-demon-king/play`
 * (compat alias `/game` unchanged).
 */
export default function Home() {
  permanentRedirect("/xi");
}
