import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Coins, UserCircle, KeyRound, Bell, LogOut, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useCredits } from "@/hooks/useCredits";

export type ProfileTab = "profile" | "credits" | "password" | "notifications";

interface Props {
  activeTab: ProfileTab;
  onChange: (tab: ProfileTab) => void;
  name: string;
  email: string;
  avatarUrl: string | null;
  onLogout: () => void;
}

const NAV: { key: ProfileTab; label: string; icon: typeof UserCircle }[] = [
  { key: "profile", label: "Hồ sơ cá nhân", icon: UserCircle },
  { key: "credits", label: "Credit", icon: CreditCard },
  { key: "password", label: "Đổi mật khẩu", icon: KeyRound },
  { key: "notifications", label: "Thông báo", icon: Bell },
];

export const ProfileSidebar = ({ activeTab, onChange, name, email, avatarUrl, onLogout }: Props) => {
  const { balance } = useCredits();
  const initials = name ? name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() : "U";

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:block lg:col-span-3">
        <div className="sticky top-24 space-y-3">
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-3 mb-3">
              <Avatar className="h-12 w-12">
                <AvatarImage src={avatarUrl || undefined} />
                <AvatarFallback className="bg-primary text-primary-foreground">{initials}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="font-semibold text-foreground truncate">{name || "Chưa đặt tên"}</p>
                <p className="text-xs text-muted-foreground truncate">{email}</p>
              </div>
            </div>
            <button
              onClick={() => onChange("credits")}
              className="w-full flex items-center justify-between rounded-lg bg-primary/10 hover:bg-primary/15 transition-colors px-3 py-2 text-sm"
            >
              <span className="text-muted-foreground">Số dư</span>
              <span className="inline-flex items-center gap-1 font-semibold text-foreground">
                <Coins className="h-4 w-4 text-primary" />
                {balance} credit
              </span>
            </button>
          </div>

          <nav className="rounded-xl border border-border bg-card p-2">
            {NAV.map(({ key, label, icon: Icon }) => {
              const active = activeTab === key;
              return (
                <button
                  key={key}
                  onClick={() => onChange(key)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors text-left",
                    active
                      ? "bg-primary/10 text-primary font-semibold"
                      : "text-foreground hover:bg-muted"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              );
            })}
          </nav>

          <Button
            variant="outline"
            onClick={onLogout}
            className="w-full text-destructive hover:text-destructive hover:bg-destructive/5"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Đăng xuất
          </Button>
        </div>
      </aside>

      {/* Mobile horizontal tabs */}
      <div className="lg:hidden -mx-4 px-4 mb-4 sticky top-16 z-30 bg-background/95 backdrop-blur border-b border-border">
        <div className="flex gap-1 overflow-x-auto py-2 scrollbar-none">
          {NAV.map(({ key, label, icon: Icon }) => {
            const active = activeTab === key;
            return (
              <button
                key={key}
                onClick={() => onChange(key)}
                className={cn(
                  "shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-colors",
                  active
                    ? "bg-primary text-primary-foreground font-semibold"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
};
