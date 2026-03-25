import { LayoutDashboard, Building, Building2, Shield } from "lucide-react";
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
import { UserMenu } from "@/components/UserMenu";

const menuItems = [
  { title: "Dashboard", path: "/admin/dashboard", icon: LayoutDashboard },
  { title: "Properties", path: "/admin/properties", icon: Building },
  { title: "Brokers", path: "/admin/brokers", icon: Shield },
  { title: "Organizations", path: "/admin/organizations", icon: Building2 },
];

export const AdminSidebar = () => {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Admin Dashboard</SidebarGroupLabel>
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
      </SidebarContent>
      
      <SidebarFooter className="border-t p-2">
        <UserMenu collapsed={collapsed} redirectPath="/admin/login" />
      </SidebarFooter>
    </Sidebar>
  );
};
