import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { LayoutDashboard, ClipboardCheck, LogOut, Handshake, MessageSquare, Layers } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const NAV = [
  { to: "/admin", label: "Tổng quan", icon: LayoutDashboard, end: true },
  { to: "/admin/kyc", label: "Duyệt KYC Công ty", icon: ClipboardCheck, end: false },
  { to: "/admin/chu-tai-san", label: "Duyệt Chủ tài sản", icon: Layers, end: false },
  { to: "/admin/collaboration", label: "Đăng ký hợp tác", icon: Handshake, end: false },
  { to: "/admin/contacts", label: "Liên hệ", icon: MessageSquare, end: false },
];

export default function AdminLayout() {
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast.success("Đã đăng xuất");
    navigate("/");
  };

  return (
    <div className="min-h-screen flex bg-muted/30">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 bg-card border-r border-border flex flex-col">
        <div className="px-5 py-5 border-b border-border">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Admin</p>
          <p className="text-sm font-bold text-foreground mt-0.5">Tài Sản Đấu Giá</p>
        </div>

        <nav className="flex-1 p-3 space-y-0.5">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                [
                  "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted",
                ].join(" ")
              }
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-border">
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            Đăng xuất
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
