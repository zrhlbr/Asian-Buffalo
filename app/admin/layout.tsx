import type { Metadata } from "next";
import "./admin.css";

export const metadata: Metadata = {
  title: "Bull Demon King · Admin Console",
  description: "R1-M7 运营管理后台 / Operations Admin Console",
};

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <div className="admin-root">{children}</div>;
}
