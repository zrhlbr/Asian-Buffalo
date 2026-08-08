import type { Metadata } from "next";
import XiShell from "../../client/xi-lobby/xi-shell.tsx";

export const metadata: Metadata = {
  title: "西游戏",
  description: "西游戏平台大厅 / XI GAME lobby",
};

/**
 * Xi segment layout — shell stays mounted; only page children swap.
 * Do not key this layout on pathname.
 */
export default function XiLayout({ children }: { children: React.ReactNode }) {
  return <XiShell>{children}</XiShell>;
}
