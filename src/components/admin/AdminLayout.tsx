import { useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  ClipboardCheck,
  LogOut,
  Layers,
  Newspaper,
  Mail,
  Megaphone,
  Users,
  UserCog,
  Building2,
  ArrowLeftRight,
  Activity,
  FileText,
  MapPin,
  ChevronDown,
  ShieldCheck,
  KeyRound,
  ScrollText,
  Package,
  ClipboardList,
  Wallet,
  UserPlus,
  Target,
  ListTodo,
  Ticket,
  type LucideIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAdminPermissions } from "@/hooks/useAdminPermissions";

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
  /** Mã module trong danh mục quyền; có mặt ⇒ menu chỉ hiện khi có quyền 'view'. */
  module?: string;
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
    title: "Quản trị & Phê duyệt",
    items: [
      { to: "/admin/nguoi-dung", label: "Quản lý người dùng", icon: UserCog, module: "nguoi-dung" },
      { to: "/admin/kyc", label: "Duyệt KYC Công ty", icon: ClipboardCheck, module: "kyc-cong-ty" },
      { to: "/admin/chu-tai-san", label: "Duyệt Chủ tài sản", icon: Layers, module: "kyc-chu-tai-san" },
    ],
  },
  {
    // Phễu bán hàng đọc từ trên xuống: tiềm năng → cơ hội → khách → đơn, và
    // Đối tác là bên cung cấp dịch vụ mình bán lại.
    title: "Bán hàng",
    items: [
      { to: "/admin/khach-hang-tiem-nang", label: "Khách hàng tiềm năng", icon: UserPlus, module: "khach-hang-tiem-nang" },
      { to: "/admin/co-hoi", label: "Cơ hội", icon: Target, module: "co-hoi" },
      { to: "/admin/khach-hang", label: "Khách hàng", icon: Users, module: "khach-hang" },
      { to: "/admin/don-hang", label: "Đơn hàng", icon: ClipboardList, module: "don-hang" },
      { to: "/admin/doi-tac", label: "Đối tác", icon: Building2, module: "nha-cung-cap" },
    ],
  },
  {
    title: "Vận hành & Hỗ trợ",
    items: [
      { to: "/admin/dich-vu", label: "Dịch vụ", icon: Package, module: "dich-vu" },
      { to: "/admin/cong-viec", label: "Công việc", icon: ListTodo, module: "cong-viec" },
      { to: "/admin/ticket", label: "Ticket", icon: Ticket, module: "lien-he" },
    ],
  },
  {
    title: "Marketing",
    items: [
      { to: "/admin/marketing/email", label: "Email Marketing", icon: Mail, module: "email" },
      {
        to: "/admin/marketing/quang-cao",
        label: "Quảng cáo",
        icon: Megaphone,
        end: true,
        module: "quang-cao",
        children: [
          { to: "/admin/marketing/quang-cao/trang", label: "Trang quảng cáo", icon: FileText, module: "quang-cao" },
          { to: "/admin/marketing/quang-cao/vi-tri", label: "Vị trí quảng cáo", icon: MapPin, module: "quang-cao" },
        ],
      },
    ],
  },
  {
    title: "Nội dung",
    items: [
      { to: "/admin/tin-tuc", label: "Tin tức", icon: Newspaper, module: "tin-tuc" },
      { to: "/admin/doi-tac-tren-san", label: "Đối tác trên sàn", icon: Building2, module: "doi-tac" },
      { to: "/admin/phap-ly", label: "Văn bản pháp lý", icon: ScrollText, module: "phap-ly" },
    ],
  },
  {
    title: "Báo cáo",
    items: [
      { to: "/admin/bao-cao/doanh-thu", label: "Doanh thu", icon: Wallet, module: "doanh-thu" },
      { to: "/admin/bao-cao/giao-dich", label: "Giao dịch credit", icon: ArrowLeftRight, module: "giao-dich" },
      { to: "/admin/bao-cao/truy-cap", label: "Phân tích truy cập", icon: Activity, module: "truy-cap" },
    ],
  },
  {
    title: "Quản trị",
    items: [
      { to: "/admin/quan-tri/tai-khoan", label: "Tài khoản quản trị", icon: ShieldCheck, module: "tai-khoan" },
      { to: "/admin/quan-tri/vai-tro", label: "Vai trò", icon: KeyRound, module: "vai-tro" },
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
  const { isSuperAdmin, matrix, ready } = useAdminPermissions();

  const canView = (item: NavItem) =>
    !item.module || isSuperAdmin || (matrix[item.module]?.includes("view") ?? false);

  // Lọc menu theo quyền 'view'. Trong lúc đang nạp quyền chỉ hiện mục không gắn
  // module (Tổng quan) để tránh nháy link chưa được phép.
  const visibleNav = NAV.map((section) => ({
    ...section,
    items: section.items.filter((it) => (ready ? canView(it) : !it.module)),
  })).filter((section) => section.items.length > 0);

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
          {visibleNav.map((section, i) => (
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
