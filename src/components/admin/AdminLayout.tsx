import { useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  ClipboardCheck,
  LogOut,
  Handshake,
  MessageSquare,
  Layers,
  Newspaper,
  Mail,
  Megaphone,
  Users,
  Sparkles,
  ChevronDown,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface NavChild {
  to: string;
  label: string;
  icon: LucideIcon;
}

interface NavLinkEntry {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

interface NavGroupEntry {
  label: string;
  icon: LucideIcon;
  basePath: string;
  children: NavChild[];
}

type NavEntry = NavLinkEntry | NavGroupEntry;

const isGroup = (e: NavEntry): e is NavGroupEntry => "children" in e;

const NAV: NavEntry[] = [
  { to: "/admin", label: "Tổng quan", icon: LayoutDashboard, end: true },
  { to: "/admin/kyc", label: "Duyệt KYC Công ty", icon: ClipboardCheck },
  { to: "/admin/chu-tai-san", label: "Duyệt Chủ tài sản", icon: Layers },
  { to: "/admin/collaboration", label: "Đăng ký hợp tác", icon: Handshake },
  { to: "/admin/contacts", label: "Liên hệ", icon: MessageSquare },
  { to: "/admin/tin-tuc", label: "Tin tức", icon: Newspaper },
  {
    label: "Marketing",
    icon: Sparkles,
    basePath: "/admin/marketing",
    children: [
      { to: "/admin/marketing/email", label: "Email Marketing", icon: Mail },
      { to: "/admin/marketing/quang-cao", label: "Quảng cáo", icon: Megaphone },
    ],
  },
  { to: "/admin/khach-hang", label: "Khách hàng", icon: Users },
];

const linkClass = (isActive: boolean) =>
  [
    "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
    isActive
      ? "bg-primary text-primary-foreground"
      : "text-muted-foreground hover:text-foreground hover:bg-muted",
  ].join(" ");

function NavGroup({ group }: { group: NavGroupEntry }) {
  const location = useLocation();
  const anyActive = location.pathname.startsWith(group.basePath);
  const [open, setOpen] = useState(anyActive);
  const Icon = group.icon;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button
          className={[
            "flex w-full items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
            anyActive ? "text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted",
          ].join(" ")}
        >
          <Icon className="h-4 w-4 shrink-0" />
          <span className="flex-1 text-left">{group.label}</span>
          {open ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="ml-3 mt-0.5 space-y-0.5 border-l border-border pl-3">
          {group.children.map(({ to, label, icon: ChildIcon }) => (
            <NavLink key={to} to={to} className={({ isActive }) => linkClass(isActive)}>
              <ChildIcon className="h-3.5 w-3.5 shrink-0" />
              {label}
            </NavLink>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export default function AdminLayout() {
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast.success("Đã đăng xuất");
    navigate("/");
  };

  return (
    <div className="h-screen flex bg-muted/30">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 bg-card border-r border-border flex flex-col">
        <div className="px-5 py-5 border-b border-border">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Admin</p>
          <p className="text-sm font-bold text-foreground mt-0.5">Tài Sản Đấu Giá</p>
        </div>

        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {NAV.map((entry) =>
            isGroup(entry) ? (
              <NavGroup key={entry.label} group={entry} />
            ) : (
              <NavLink
                key={entry.to}
                to={entry.to}
                end={entry.end}
                className={({ isActive }) => linkClass(isActive)}
              >
                <entry.icon className="h-4 w-4 shrink-0" />
                {entry.label}
              </NavLink>
            ),
          )}
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
