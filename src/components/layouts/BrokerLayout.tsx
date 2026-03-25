import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { BrokerSidebar } from "@/components/portal/BrokerSidebar";
import { BrokerMobileNav } from "@/components/portal/BrokerMobileNav";
import { Outlet } from "react-router-dom";
import { Building2, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";

export const BrokerLayout = () => {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        {/* Desktop Sidebar */}
        <BrokerSidebar />
        
        <div className="flex flex-1 flex-col h-screen overflow-hidden">
          {/* Desktop Header */}
          <header className="flex-shrink-0 z-40 flex h-16 items-center gap-4 border-b bg-background px-4 md:px-6">
            <SidebarTrigger className="md:flex hidden" />
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              <span className="font-semibold text-foreground hidden sm:inline">Broker Dashboard</span>
              <span className="font-semibold text-foreground sm:hidden text-sm">BĐS Broker</span>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Button variant="ghost" size="icon" className="touch-manipulation active:scale-95">
                <Bell className="h-5 w-5" />
              </Button>
            </div>
          </header>
          
          {/* Main Content with bottom padding for mobile nav */}
          <main className="flex-1 overflow-y-auto bg-muted/40 p-4 md:p-6 pb-20 md:pb-6">
            <Outlet />
          </main>
          
          {/* Mobile Bottom Navigation */}
          <BrokerMobileNav />
        </div>
      </div>
    </SidebarProvider>
  );
};
