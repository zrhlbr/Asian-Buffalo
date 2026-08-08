import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "牛魔王",
  description: "牛魔王 / BULL DEMON KING — formal play (Session / Spin / Round)",
};

/** Step 3 play layout — title override only; does not alter hub layout content. */
export default function BullDemonKingPlayLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
