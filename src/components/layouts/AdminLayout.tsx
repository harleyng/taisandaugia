import { SidebarProvider } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { Outlet } from "react-router-dom";

export const AdminLayout = () => {
  return (
    <SidebarProvider>
      <div className="flex h-screen w-full overflow-hidden">
        <AdminSidebar />
        
        <main className="flex-1 overflow-y-auto p-6 bg-muted/40">
          <Outlet />
        </main>
      </div>
    </SidebarProvider>
  );
};
