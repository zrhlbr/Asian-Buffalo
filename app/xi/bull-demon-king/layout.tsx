import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "西游戏之牛魔王",
  description: "西游戏之牛魔王 / XI GAME · Bull Demon King hub",
};

/** Step 2 hub layout — independent from lobby shell. */
export default function BullDemonKingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
