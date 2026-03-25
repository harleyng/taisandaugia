import { Home, Building, Users, Megaphone, Building2, User, ArrowLeft } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { NavLink } from "react-router-dom";
import { Separator } from "@/components/ui/separator";
import { UserMenu } from "@/components/UserMenu";

const menuItems = [
  { title: "Dashboard", path: "/broker/dashboard", icon: Home, description: "Tổng quan" },
  { title: "Hồ sơ cá nhân", path: "/broker/profile", icon: User, description: "Xác thực và quản lý" },
  { title: "Quản lý tin đăng", path: "/broker/properties", icon: Building, description: "CRUD và kiểm soát" },
  { title: "Quản lý khách hàng", path: "/broker/customers", icon: Users, description: "CRM" },
  { title: "Marketing", path: "/broker/marketing", icon: Megaphone, description: "Chiến dịch" },
  { title: "Tổ chức", path: "/broker/organizations", icon: Building2, description: "Quản lý văn phòng" },
];

export const BrokerSidebar = () => {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Broker Dashboard</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => {
                const Icon = item.icon;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink 
                        to={item.path}
                        className={({ isActive }) =>
                          isActive ? "bg-accent text-accent-foreground" : ""
                        }
                      >
                        <Icon className="h-4 w-4" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <Separator className="my-2" />

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <NavLink to="/" className="text-muted-foreground hover:text-foreground">
                    <ArrowLeft className="h-4 w-4" />
                    {!collapsed && <span>Quay về Marketplace</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      
      <SidebarFooter className="border-t p-2">
        <UserMenu collapsed={collapsed} redirectPath="/auth" />
      </SidebarFooter>
    </Sidebar>
  );
};
