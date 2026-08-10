import type { Metadata } from "next";
import "./admin.css";

export const metadata: Metadata = {
  title: "西游戏 · XI GAME Admin",
  description: "西游戏运营管理后台 / XI GAME Operations Admin Console",
};

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <div className="admin-root">{children}</div>;
}
