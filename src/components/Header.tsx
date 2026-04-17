import { Link, useNavigate, useLocation } from "react-router-dom";
import { Menu, User, Heart, PlusCircle, LogOut, ChevronDown, Home, LayoutGrid, UserCircle, Coins, Sparkles } from "lucide-react";
import logo from "@/assets/logo.png";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { Session } from "@supabase/supabase-js";
import { ASSET_CATEGORIES } from "@/constants/category.constants";
import { useAuthDialog } from "@/contexts/AuthDialogContext";
import { useCredits } from "@/hooks/useCredits";
import { addCredits as addCreditsImpl } from "@/lib/mockCredits";

export const Header = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { openAuthDialog } = useAuthDialog();
  const isHomePage = location.pathname === "/";
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll);
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const { toast } = useToast();
  const [session, setSession] = useState<Session | null>(null);
  const { balance } = useCredits();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_, session) => setSession(session));
    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast({ title: "Đăng xuất thành công", description: "Hẹn gặp lại bạn!" });
    navigate("/");
  };

  const transparent = isHomePage && !scrolled;

  return (
    <header
      className={`${isHomePage ? "fixed" : "relative"} top-0 z-50 w-full transition-all duration-300 ${transparent ? "bg-transparent border-transparent" : "bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border"}`}
    >
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-6">
          <Link
            to="/"
            className={`flex items-center transition-colors ${transparent ? "text-white" : "text-foreground"}`}
          >
            <img
              src={logo}
              alt="Asset Auction - tàisảnđấugiá"
              className={`h-8 md:h-9 object-contain transition-all duration-300 ${transparent ? "brightness-0 invert" : ""}`}
            />
          </Link>

          {/* Desktop Mega Menu */}
          <NavigationMenu className="hidden md:flex">
            <NavigationMenuList>
              <NavigationMenuItem>
                <NavigationMenuTrigger
                  className={`gap-1.5 ${transparent ? "bg-transparent text-white/90 hover:text-white hover:bg-white/10 data-[state=open]:bg-white/10" : ""}`}
                >
                  <LayoutGrid className="h-4 w-4" />
                  Danh mục
                </NavigationMenuTrigger>
                <NavigationMenuContent>
                  <div className="grid grid-cols-5 gap-6 p-6 w-[720px]">
                    {ASSET_CATEGORIES.map((cat) => {
                      const Icon = cat.icon;
                      return (
                        <div key={cat.slug}>
                          <Link
                            to={`/listings?category=${cat.slug}`}
                            className="flex items-center gap-2 mb-3 font-semibold text-sm text-foreground hover:text-primary transition-colors"
                          >
                            <Icon className="h-4 w-4 text-primary" />
                            {cat.name}
                          </Link>
                          <ul className="space-y-1.5">
                            {cat.children.map((child) => (
                              <li key={child.slug}>
                                <Link
                                  to={`/listings?category=${cat.slug}&sub=${child.slug}`}
                                  className="block text-sm text-muted-foreground hover:text-primary transition-colors py-0.5"
                                >
                                  {child.name}
                                </Link>
                              </li>
                            ))}
                          </ul>
                        </div>
                      );
                    })}
                  </div>
                </NavigationMenuContent>
              </NavigationMenuItem>
            </NavigationMenuList>
          </NavigationMenu>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {session ? (
            <>
              <button
                onClick={() => navigate("/buy-credits")}
                className={`hidden sm:inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                  transparent
                    ? "bg-white/15 text-white hover:bg-white/25"
                    : "bg-primary/10 text-primary hover:bg-primary/20"
                }`}
                title="Mua credit"
              >
                <Coins className="h-3.5 w-3.5" />
                {balance} credit
              </button>
              <Button
                variant="ghost"
                size="icon"
                className={`hidden sm:inline-flex ${transparent ? "text-white/90 hover:text-white hover:bg-white/10" : ""}`}
                onClick={() => navigate("/saved-assets")}
              >
                <Heart className="h-5 w-5" />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className={`hidden sm:inline-flex gap-2 ${transparent ? "text-white/90 hover:text-white hover:bg-white/10" : ""}`}
                  >
                    <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-semibold text-sm">
                      U
                    </div>
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-60">
                  <DropdownMenuLabel className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground font-normal">Số dư</span>
                    <span className="inline-flex items-center gap-1 font-semibold text-foreground">
                      <Coins className="h-3.5 w-3.5 text-primary" />
                      {balance} credit
                    </span>
                  </DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => navigate("/buy-credits")}>
                    <Coins className="mr-2 h-4 w-4 text-primary" />
                    Mua credit
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate("/profile")}>
                    <UserCircle className="mr-2 h-4 w-4" />
                    Hồ sơ cá nhân
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/saved-assets")}>
                    <Heart className="mr-2 h-4 w-4" />
                    Tài sản quan tâm
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => {
                      addCreditsImpl(500);
                      toast({ title: "Dev: +500 credit", description: "Chỉ dùng để thử nghiệm." });
                    }}
                    className="text-xs text-muted-foreground"
                  >
                    <Sparkles className="mr-2 h-3.5 w-3.5" />
                    Dev: +500 credit
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout}>
                    <LogOut className="mr-2 h-4 w-4" />
                    Đăng xuất
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <Button
              onClick={() => openAuthDialog()}
              className="hidden sm:inline-flex bg-foreground hover:bg-foreground/90 text-background"
            >
              <User className="mr-2 h-4 w-4" />
              Đăng nhập
            </Button>
          )}

          {/* Mobile Menu */}
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent className="w-[300px] sm:w-[400px]">
              <nav className="flex flex-col gap-2 mt-8">
                <div className="pb-4 border-b">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-3">Trang chủ</h3>
                  <Link
                    to="/"
                    className="flex items-center gap-3 px-3 py-2.5 text-base font-medium text-foreground hover:text-primary hover:bg-muted rounded-lg transition-colors"
                  >
                    <Home className="h-5 w-5" />
                    Trang chủ
                  </Link>
                </div>

                {/* Mobile Category Accordion */}
                <div className="pb-4 border-b">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-3">Danh mục tài sản</h3>
                  <Accordion type="single" collapsible className="w-full">
                    {ASSET_CATEGORIES.map((cat) => {
                      const Icon = cat.icon;
                      return (
                        <AccordionItem key={cat.slug} value={cat.slug} className="border-none">
                          <AccordionTrigger className="py-2.5 px-3 hover:no-underline hover:bg-muted rounded-lg text-base font-medium">
                            <span className="flex items-center gap-3">
                              <Icon className="h-5 w-5 text-primary" />
                              {cat.name}
                            </span>
                          </AccordionTrigger>
                          <AccordionContent className="pb-1">
                            <div className="ml-11 space-y-0.5">
                              {cat.children.map((child) => (
                                <Link
                                  key={child.slug}
                                  to={`/listings?category=${cat.slug}&sub=${child.slug}`}
                                  className="block px-3 py-2 text-sm text-muted-foreground hover:text-primary hover:bg-muted rounded-md transition-colors"
                                >
                                  {child.name}
                                </Link>
                              ))}
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      );
                    })}
                  </Accordion>
                </div>

                {session ? (
                  <>
                    <div className="py-4 border-b">
                      <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-3">Tài khoản</h3>
                      <Link
                        to="/profile"
                        className="flex items-center gap-3 px-3 py-2.5 text-base font-medium text-foreground hover:text-primary hover:bg-muted rounded-lg transition-colors"
                      >
                        <UserCircle className="h-5 w-5" />
                        Hồ sơ cá nhân
                      </Link>
                      <Link
                        to="/saved-assets"
                        className="flex items-center gap-3 px-3 py-2.5 text-base font-medium text-foreground hover:text-primary hover:bg-muted rounded-lg transition-colors"
                      >
                        <Heart className="h-5 w-5" />
                        Tài sản quan tâm
                      </Link>
                    </div>
                    <div className="pt-4 space-y-2">
                      <Button onClick={handleLogout} variant="outline" className="w-full justify-start">
                        <LogOut className="mr-2 h-5 w-5" />
                        Đăng xuất
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="pt-4 space-y-2">
                    <Button
                      onClick={() => openAuthDialog()}
                      className="w-full bg-primary hover:bg-primary-hover text-primary-foreground justify-start"
                    >
                      <User className="mr-2 h-5 w-5" />
                      Đăng nhập
                    </Button>
                  </div>
                )}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
};
