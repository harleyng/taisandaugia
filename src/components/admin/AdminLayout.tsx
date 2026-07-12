import { useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  ClipboardCheck,
  LogOut,
  MessageSquare,
  Layers,
  Newspaper,
  Mail,
  Megaphone,
  Users,
  UserCog,
  Building2,
  ArrowLeftRight,
  FileText,
  MapPin,
  ChevronDown,
  type LucideIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
  /** Nested sub-menu rendered indented beneath this item. */
  children?: NavItem[];
}

interface NavSection {
  /** Uppercase block heading; omit for the top-level standalone items. */
  title?: string;
  items: NavItem[];
}

const NAV: NavSection[] = [
  {
    items: [{ to: "/admin", label: "Tổng quan", icon: LayoutDashboard, end: true }],
  },
  {
    title: "Chăm sóc khách hàng",
    items: [
      { to: "/admin/nguoi-dung", label: "Quản lý người dùng", icon: UserCog },
      { to: "/admin/kyc", label: "Duyệt KYC Công ty", icon: ClipboardCheck },
      { to: "/admin/chu-tai-san", label: "Duyệt Chủ tài sản", icon: Layers },
      { to: "/admin/lien-he-hop-tac", label: "Liên hệ & Hợp tác", icon: MessageSquare },
    ],
  },
  {
    title: "Nội dung",
    items: [
      { to: "/admin/tin-tuc", label: "Tin tức", icon: Newspaper },
      { to: "/admin/doi-tac", label: "Quản lý đối tác", icon: Building2 },
    ],
  },
  {
    title: "Marketing",
    items: [
      { to: "/admin/marketing/email", label: "Email Marketing", icon: Mail },
      {
        to: "/admin/marketing/quang-cao",
        label: "Quảng cáo",
        icon: Megaphone,
        end: true,
        children: [
          { to: "/admin/marketing/quang-cao/trang", label: "Trang quảng cáo", icon: FileText },
          { to: "/admin/marketing/quang-cao/vi-tri", label: "Vị trí quảng cáo", icon: MapPin },
        ],
      },
      { to: "/admin/khach-hang", label: "Khách hàng", icon: Users },
    ],
  },
  {
    title: "Báo cáo",
    items: [
      { to: "/admin/bao-cao/giao-dich", label: "Giao dịch", icon: ArrowLeftRight },
    ],
  },
];

const linkClass = (isActive: boolean) =>
  [
    "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
    isActive
      ? "bg-primary text-primary-foreground"
      : "text-muted-foreground hover:text-foreground hover:bg-muted",
  ].join(" ");

export default function AdminLayout() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const isWithin = (to: string) => pathname === to || pathname.startsWith(to + "/");

  /** Parent stays active across its whole section, except when a child owns the highlight. */
  const parentActive = (item: NavItem) =>
    isWithin(item.to) && !(item.children ?? []).some((c) => isWithin(c.to));

  // Collapse state per parent; defaults open when the current route is inside the section.
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({});
  const isOpen = (item: NavItem) => openMenus[item.to] ?? isWithin(item.to);
  const toggleMenu = (to: string) =>
    setOpenMenus((m) => ({ ...m, [to]: !(m[to] ?? isWithin(to)) }));

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

        <nav className="flex-1 p-3 overflow-y-auto">
          {NAV.map((section, i) => (
            <div key={section.title ?? "top"} className={i > 0 ? "mt-5" : ""}>
              {section.title && (
                <p className="px-3 mb-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  {section.title}
                </p>
              )}
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const { to, label, icon: Icon, end, children } = item;

                  if (!children) {
                    return (
                      <NavLink
                        key={to}
                        to={to}
                        end={end}
                        className={({ isActive }) => linkClass(isActive)}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        {label}
                      </NavLink>
                    );
                  }

                  const active = parentActive(item);
                  const open = isOpen(item);
                  const textClass = active
                    ? "text-primary-foreground"
                    : "text-muted-foreground group-hover:text-foreground";
                  return (
                    <div key={to}>
                      <div
                        className={[
                          "group flex items-center rounded-lg transition-colors",
                          active ? "bg-primary" : "hover:bg-muted",
                        ].join(" ")}
                      >
                        <NavLink
                          to={to}
                          end={end}
                          className={`flex items-center gap-2.5 flex-1 min-w-0 px-3 py-2 text-sm font-medium ${textClass}`}
                        >
                          <Icon className="h-4 w-4 shrink-0" />
                          {label}
                        </NavLink>
                        <button
                          type="button"
                          onClick={() => toggleMenu(to)}
                          aria-label={open ? "Thu gọn" : "Mở rộng"}
                          aria-expanded={open}
                          className={`shrink-0 pl-1 pr-2.5 py-2 ${textClass}`}
                        >
                          <ChevronDown
                            className={`h-4 w-4 transition-transform ${open ? "" : "-rotate-90"}`}
                          />
                        </button>
                      </div>
                      {open && (
                        <div className="mt-0.5 space-y-0.5">
                          {children.map(({ to: cto, label: clabel, icon: CIcon, end: cend }) => (
                            <NavLink
                              key={cto}
                              to={cto}
                              end={cend}
                              className={({ isActive }) => `${linkClass(isActive)} pl-9 text-[13px]`}
                            >
                              <CIcon className="h-3.5 w-3.5 shrink-0" />
                              {clabel}
                            </NavLink>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
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
