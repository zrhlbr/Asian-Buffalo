import AdminApp from "../admin-app.tsx";

/**
 * Explicit `/admin/login` entry — same AdminApp SPA gate as `/admin`
 * (LoginScreen when no token). No second admin stack.
 */
export default function AdminLoginPage() {
  return <AdminApp />;
}
