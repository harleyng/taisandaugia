import { Link, useNavigate, useLocation } from "react-router-dom";
import { Building2, Menu, User, Heart, PlusCircle, LogOut, Bell, ChevronDown, Home, Building, Users, Megaphone, LayoutGrid } from "lucide-react";
import logo from "@/assets/logo.png";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { NavigationMenu, NavigationMenuContent, NavigationMenuItem, NavigationMenuList, NavigationMenuTrigger } from "@/components/ui/navigation-menu";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { Session } from "@supabase/supabase-js";
import { ASSET_CATEGORIES } from "@/constants/category.constants";
import { useAuthDialog } from "@/contexts/AuthDialogContext";

export const Header = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { openAuthDialog } = useAuthDialog();
  const isHomePage = location.pathname === "/";
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll);
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);
  const { toast } = useToast();
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) checkUserRoles(session.user.id);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      if (session) checkUserRoles(session.user.id);else
      setIsAdmin(false);
    });
    return () => subscription.unsubscribe();
  }, []);
  const checkUserRoles = async (userId: string) => {
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    if (data) {
      setIsAdmin(data.map((r) => r.role as string).includes("ADMIN"));
    }
  };
  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast({ title: "Đăng xuất thành công", description: "Hẹn gặp lại bạn!" });
    navigate("/");
  };
  const transparent = isHomePage && !scrolled;

  return (
    <header className={`${isHomePage ? 'fixed' : 'relative'} top-0 z-50 w-full transition-all duration-300 ${transparent ? 'bg-transparent border-transparent' : 'bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border'}`}>
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-6">
          <Link to="/" className={`flex items-center transition-colors ${transparent ? 'text-white' : 'text-foreground'}`}>
            <img src={logo} alt="Asset Auction - tàisảnđấugiá" className={`h-8 md:h-9 object-contain transition-all duration-300 ${transparent ? 'brightness-0 invert' : ''}`} />
          </Link>

          {/* Desktop Mega Menu */}
          <NavigationMenu className="hidden md:flex">
            <NavigationMenuList>
              <NavigationMenuItem>
                <NavigationMenuTrigger className={`gap-1.5 ${transparent ? 'bg-transparent text-white/90 hover:text-white hover:bg-white/10 data-[state=open]:bg-white/10' : ''}`}>
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
                            className="flex items-center gap-2 mb-3 font-semibold text-sm text-foreground hover:text-primary transition-colors">
                            
                            <Icon className="h-4 w-4 text-primary" />
                            {cat.name}
                          </Link>
                          <ul className="space-y-1.5">
                            {cat.children.map((child) =>
                            <li key={child.slug}>
                                <Link
                                to={`/listings?category=${cat.slug}&sub=${child.slug}`}
                                className="block text-sm text-muted-foreground hover:text-primary transition-colors py-0.5">
                                
                                  {child.name}
                                </Link>
                              </li>
                            )}
                          </ul>
                        </div>);

                    })}
                  </div>
                </NavigationMenuContent>
              </NavigationMenuItem>
            </NavigationMenuList>
          </NavigationMenu>
        </div>

        <div className="flex items-center gap-4">
          {session ?
          <>
              <Button variant="ghost" size="icon" className="hidden sm:inline-flex" onClick={() => navigate("/saved-assets")}>
                <Heart className="h-5 w-5" />
              </Button>
              <Button variant="ghost" size="icon" className="hidden sm:inline-flex relative">
                <Bell className="h-5 w-5" />
                <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 bg-destructive text-destructive-foreground text-xs">2</Badge>
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="hidden sm:inline-flex gap-2">
                    <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-semibold">U</div>
                    <span className="text-sm font-medium">{session.user.email?.split('@')[0] || 'user'}</span>
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  {!isAdmin &&
                <>
                      <DropdownMenuItem onClick={() => navigate("/broker/dashboard")}><Home className="mr-2 h-4 w-4" />Dashboard</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate("/broker/profile")}><User className="mr-2 h-4 w-4" />Hồ sơ cá nhân</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate("/broker/properties")}><Building className="mr-2 h-4 w-4" />Quản lý tin đăng</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate("/broker/customers")}><Users className="mr-2 h-4 w-4" />Quản lý khách hàng</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate("/broker/marketing")}><Megaphone className="mr-2 h-4 w-4" />Marketing</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate("/broker/organization")}><Building2 className="mr-2 h-4 w-4" />Tổ chức</DropdownMenuItem>
                    </>
                }
                  <DropdownMenuItem onClick={handleLogout}><LogOut className="mr-2 h-4 w-4" />Đăng xuất</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button onClick={() => navigate("/broker/properties/new")} className="hidden sm:inline-flex bg-primary hover:bg-primary-hover text-primary-foreground">
                <PlusCircle className="mr-2 h-4 w-4" />Đăng tin
              </Button>
            </> :

          <>
              
              <Button onClick={() => openAuthDialog()} className="hidden sm:inline-flex bg-foreground hover:bg-foreground/90 text-background">
                <User className="mr-2 h-4 w-4" />Đăng nhập
              </Button>
            </>
          }

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
                  <Link to="/" className="flex items-center gap-3 px-3 py-2.5 text-base font-medium text-foreground hover:text-primary hover:bg-muted rounded-lg transition-colors">
                    <Home className="h-5 w-5" />Trang chủ
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
                              {cat.children.map((child) =>
                              <Link
                                key={child.slug}
                                to={`/listings?category=${cat.slug}&sub=${child.slug}`}
                                className="block px-3 py-2 text-sm text-muted-foreground hover:text-primary hover:bg-muted rounded-md transition-colors">
                                
                                  {child.name}
                                </Link>
                              )}
                            </div>
                          </AccordionContent>
                        </AccordionItem>);

                    })}
                  </Accordion>
                </div>

                {session ?
                <>
                    {!isAdmin &&
                  <div className="py-4 border-b">
                        <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-3">Broker Portal</h3>
                        <Link to="/broker/dashboard" className="flex items-center gap-3 px-3 py-2.5 text-base font-medium text-foreground hover:text-primary hover:bg-muted rounded-lg transition-colors"><Home className="h-5 w-5" />Dashboard</Link>
                        <Link to="/broker/profile" className="flex items-center gap-3 px-3 py-2.5 text-base font-medium text-foreground hover:text-primary hover:bg-muted rounded-lg transition-colors"><User className="h-5 w-5" />Hồ sơ cá nhân</Link>
                        <Link to="/broker/properties" className="flex items-center gap-3 px-3 py-2.5 text-base font-medium text-foreground hover:text-primary hover:bg-muted rounded-lg transition-colors"><Building className="h-5 w-5" />Quản lý tin đăng</Link>
                        <Link to="/broker/customers" className="flex items-center gap-3 px-3 py-2.5 text-base font-medium text-foreground hover:text-primary hover:bg-muted rounded-lg transition-colors"><Users className="h-5 w-5" />Quản lý khách hàng</Link>
                        <Link to="/broker/marketing" className="flex items-center gap-3 px-3 py-2.5 text-base font-medium text-foreground hover:text-primary hover:bg-muted rounded-lg transition-colors"><Megaphone className="h-5 w-5" />Marketing</Link>
                        <Link to="/broker/organization" className="flex items-center gap-3 px-3 py-2.5 text-base font-medium text-foreground hover:text-primary hover:bg-muted rounded-lg transition-colors"><Building2 className="h-5 w-5" />Tổ chức</Link>
                        <Link to="/broker/properties/new" className="flex items-center gap-3 px-3 py-2.5 text-base font-medium bg-primary text-primary-foreground hover:bg-primary-hover rounded-lg transition-colors mt-3"><PlusCircle className="h-5 w-5" />Đăng tin</Link>
                      </div>
                  }
                    <div className="pt-4 space-y-2">
                      <Button onClick={handleLogout} variant="outline" className="w-full justify-start"><LogOut className="mr-2 h-5 w-5" />Đăng xuất</Button>
                    </div>
                  </> :

                <div className="pt-4 space-y-2">
                    <Button onClick={() => openAuthDialog()} className="w-full bg-primary hover:bg-primary-hover text-primary-foreground justify-start"><User className="mr-2 h-5 w-5" />Đăng nhập</Button>
                    <Link to="#" className="flex items-center justify-center gap-2 text-sm font-medium text-foreground hover:text-primary py-2">Tải ứng dụng</Link>
                  </div>
                }
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>);

};