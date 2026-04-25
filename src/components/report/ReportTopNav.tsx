import { Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import logo from "@/assets/logo.png";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuthDialog } from "@/contexts/AuthDialogContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, UserCircle } from "lucide-react";
import { resolveDisplayName } from "@/lib/displayName";
import { useToast } from "@/hooks/use-toast";

const navItems = [
  { label: "Cơ sở dữ liệu", to: "/listings" },
  { label: "Báo cáo", to: "/report" },
  { label: "Đăng ký nhận báo cáo", to: "/report#subscribe" },
];

export const ReportTopNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = location.pathname;
  const { openAuthDialog } = useAuthDialog();
  const { toast } = useToast();
  const [session, setSession] = useState<Session | null>(null);
  const [profileName, setProfileName] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, s) => setSession(s));
    supabase.auth.getSession().then(({ data: { session: s } }) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) {
      setProfileName(null);
      setAvatarUrl(null);
      return;
    }
    supabase
      .from("profiles")
      .select("name, agent_info")
      .eq("id", session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        setProfileName(data?.name ?? null);
        const agentInfo = (data?.agent_info as any) || {};
        setAvatarUrl(agentInfo?.profile_picture_url || null);
      });
  }, [session]);

  const displayName = resolveDisplayName(profileName, session?.user.id);
  const initials = displayName.slice(0, 2).toUpperCase();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast({ title: "Đăng xuất thành công", description: "Hẹn gặp lại bạn!" });
    navigate("/");
  };

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
