import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { Session } from "@supabase/supabase-js";

const Auth = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get("invite");
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [session, setSession] = useState<Session | null>(null);

  // Login form state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Signup form state
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");

  useEffect(() => {
    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        navigate("/");
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      if (session) {
        navigate("/");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: authData, error } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: loginPassword,
      });

      if (error) throw error;

      // Check if user has ADMIN role - block admin from marketplace
      if (authData.user) {
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", authData.user.id)
          .eq("role", "ADMIN")
          .maybeSingle();

        if (roleData) {
          // User is ADMIN - logout and show error
          await supabase.auth.signOut();
          toast({
            title: "Truy cập bị từ chối",
            description: "Tài khoản admin không thể đăng nhập vào marketplace. Vui lòng sử dụng trang admin riêng.",
            variant: "destructive",
          });
          setLoading(false);
          return;
        }

        // If there's an invite token, link the user to the organization
        if (inviteToken) {
          console.log("Login with invite token:", inviteToken);
          
          // First check if invite exists and hasn't been claimed
          const { data: existingInvite, error: checkError } = await supabase
            .from("organization_memberships")
            .select("*")
            .eq("invite_token", inviteToken)
            .is("user_id", null)
            .maybeSingle();

          console.log("Existing invite on login:", existingInvite, "Check error:", checkError);

          if (checkError || !existingInvite) {
            console.error("Invite not found or already claimed:", checkError);
            toast({
              title: "Lỗi liên kết tổ chức",
              description: "Không tìm thấy lời mời hoặc lời mời đã được sử dụng.",
              variant: "destructive",
            });
          } else {
            // Update the membership
            const { data: updateData, error: inviteError } = await supabase
              .from("organization_memberships")
              .update({ 
                user_id: authData.user.id,
                status: 'ACTIVE',
                joined_at: new Date().toISOString(),
                invite_email: null 
              })
              .eq("invite_token", inviteToken)
              .is("user_id", null)
              .select();

            console.log("Update result on login:", updateData, "Update error:", inviteError);

            if (inviteError || !updateData || updateData.length === 0) {
              console.error("Error linking invite on login:", inviteError);
              toast({
                title: "Lỗi liên kết tổ chức",
                description: "Không thể thêm bạn vào tổ chức. Vui lòng thử lại.",
                variant: "destructive",
              });
            } else {
              toast({
                title: "Đăng nhập thành công",
                description: "Bạn đã được thêm vào tổ chức!",
              });
              // Redirect to broker dashboard
              setTimeout(() => navigate("/broker/dashboard"), 2000);
              setLoading(false);
              return;
            }
          }
        }
      }

      toast({
        title: "Đăng nhập thành công",
        description: "Chào mừng bạn trở lại!",
      });
    } catch (error: any) {
      toast({
        title: "Lỗi đăng nhập",
        description: error.message || "Vui lòng kiểm tra email và mật khẩu",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: authData, error } = await supabase.auth.signUp({
        email: signupEmail,
        password: signupPassword,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
        },
      });

      if (error) throw error;

      // If there's an invite token, link the user to the organization
      if (inviteToken && authData.user) {
        // First check if invite exists
        const { data: existingInvite, error: checkError } = await supabase
          .from("organization_memberships")
          .select("*")
          .eq("invite_token", inviteToken)
          .is("user_id", null)
          .maybeSingle();

        console.log("Existing invite:", existingInvite, "Check error:", checkError);

        if (checkError || !existingInvite) {
          console.error("Invite not found or error:", checkError);
          toast({
            title: "Lỗi liên kết tổ chức",
            description: "Không tìm thấy lời mời hoặc lời mời đã được sử dụng.",
            variant: "destructive",
          });
        } else {
          // Update the membership
          const { data: updateData, error: inviteError } = await supabase
            .from("organization_memberships")
            .update({ 
              user_id: authData.user.id,
              status: 'ACTIVE',
              joined_at: new Date().toISOString(),
              invite_email: null 
            })
            .eq("invite_token", inviteToken)
            .is("user_id", null)
            .select();

          console.log("Update result:", updateData, "Update error:", inviteError);

          if (inviteError || !updateData || updateData.length === 0) {
            console.error("Error linking invite:", inviteError);
            toast({
              title: "Lỗi liên kết tổ chức",
              description: "Không thể thêm bạn vào tổ chức. Vui lòng thử lại.",
              variant: "destructive",
            });
          } else {
            toast({
              title: "Đăng ký thành công",
              description: "Bạn đã được thêm vào tổ chức!",
            });
            // Redirect to broker dashboard
            setTimeout(() => navigate("/broker/dashboard"), 2000);
            setLoading(false);
            return;
          }
        }
      }

      toast({
        title: "Đăng ký thành công",
        description: "Tài khoản của bạn đã được tạo!",
      });

      // Clear form
      setSignupEmail("");
      setSignupPassword("");
    } catch (error: any) {
      toast({
        title: "Lỗi đăng ký",
        description: error.message || "Không thể tạo tài khoản",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (session) {
    return null; // Will redirect
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center">Real Estate Marketplace</CardTitle>
          <CardDescription className="text-center">
            Đăng nhập hoặc tạo tài khoản mới
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Đăng nhập</TabsTrigger>
              <TabsTrigger value="signup">Đăng ký</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email">Email</Label>
                  <Input
                    id="login-email"
                    type="email"
                    placeholder="your@email.com"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">Mật khẩu</Label>
                  <Input
                    id="login-password"
                    type="password"
                    placeholder="••••••••"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Đăng nhập
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignup} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="your@email.com"
                    value={signupEmail}
                    onChange={(e) => setSignupEmail(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Mật khẩu</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    placeholder="••••••••"
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    required
                    disabled={loading}
                    minLength={6}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Đăng ký
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
