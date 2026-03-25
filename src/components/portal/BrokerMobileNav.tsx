import { Home, Building2, Users, TrendingUp, Menu } from "lucide-react";
import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { UserMenu } from "@/components/UserMenu";

const mobileNavItems = [
  {
    title: "Tổng quan",
    path: "/broker/dashboard",
    icon: Home
  },
  {
    title: "BĐS",
    path: "/broker/properties",
    icon: Building2
  },
  {
    title: "Khách",
    path: "/broker/customers",
    icon: Users
  },
  {
    title: "Marketing",
    path: "/broker/marketing",
    icon: TrendingUp
  }
];

export const BrokerMobileNav = () => {
  return (
    <>
      {/* Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border safe-area-inset-bottom">
        <div className="flex items-center justify-around h-16 px-2">
          {mobileNavItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  cn(
                    "flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg transition-all duration-200 min-w-[64px] touch-manipulation active:scale-95",
                    isActive
                      ? "text-primary bg-primary/10"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent"
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon className={cn("h-5 w-5", isActive && "animate-scale-in")} />
                    <span className="text-[10px] font-medium">{item.title}</span>
                  </>
                )}
              </NavLink>
            );
          })}
          
          {/* Menu Sheet Trigger */}
          <Sheet>
            <SheetTrigger asChild>
              <button className="flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-all duration-200 min-w-[64px] touch-manipulation active:scale-95">
                <Menu className="h-5 w-5" />
                <span className="text-[10px] font-medium">Menu</span>
              </button>
            </SheetTrigger>
            <SheetContent side="bottom" className="h-[80vh] rounded-t-xl">
              <div className="flex flex-col h-full">
                <h2 className="text-xl font-semibold mb-6">Menu</h2>
                
                {/* Additional Menu Items */}
                <div className="space-y-2 flex-1">
                  <NavLink
                    to="/broker/profile"
                    className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-accent transition-colors touch-manipulation active:scale-95"
                  >
                    <span className="font-medium">Hồ sơ</span>
                  </NavLink>
                  <NavLink
                    to="/broker/organizations"
                    className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-accent transition-colors touch-manipulation active:scale-95"
                  >
                    <span className="font-medium">Tổ chức</span>
                  </NavLink>
                  <NavLink
                    to="/"
                    className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-accent transition-colors touch-manipulation active:scale-95"
                  >
                    <span className="font-medium">Quay về Marketplace</span>
                  </NavLink>
                </div>
                
                {/* User Menu at Bottom */}
                <div className="border-t border-border pt-4 mt-4">
                  <UserMenu />
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </nav>
      
      {/* Spacer to prevent content from being hidden behind bottom nav */}
      <div className="md:hidden h-16" />
    </>
  );
};
