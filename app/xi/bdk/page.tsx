import { permanentRedirect } from "next/navigation";

/**
 * Legacy alias — permanent redirect to canonical hub.
 * Also mirrored in next.config.ts (301 when config redirects apply).
 */
export default function LegacyXiBdkRedirectPage() {
  permanentRedirect("/xi/bull-demon-king");
}
