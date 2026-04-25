import { Link, useLocation } from "react-router-dom";
import logo from "@/assets/logo.png";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Cơ sở dữ liệu", to: "/listings" },
  { label: "Báo cáo", to: "/report" },
  { label: "Đăng ký nhận báo cáo", to: "/report#subscribe" },
];

export const ReportTopNav = () => {
  const location = useLocation();
  const currentPath = location.pathname;

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="container flex h-16 items-center justify-between gap-6">
        <div className="flex items-center gap-8">
          <Link to="/" className="flex items-center">
            <img src={logo} alt="Asset Auction" className="h-8 md:h-9 object-contain" />
          </Link>
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const isActive =
                item.to === "/report"
                  ? currentPath === "/report"
                  : currentPath.startsWith(item.to.split("#")[0]);
              return (
                <Link
                  key={item.label}
                  to={item.to}
                  className={cn(
                    "px-3 py-2 rounded-md text-sm font-medium transition-colors",
                    isActive
                      ? "text-primary bg-primary/10"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="hidden sm:inline-flex">
            Đăng nhập
          </Button>
        </div>
      </div>
    </header>
  );
};
