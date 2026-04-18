import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ProfileSidebar, ProfileTab } from "@/components/profile/ProfileSidebar";
import { ProfileInfoTab } from "@/components/profile/tabs/ProfileInfoTab";
import { CreditsTab } from "@/components/profile/tabs/CreditsTab";
import { PasswordTab } from "@/components/profile/tabs/PasswordTab";
import { NotificationsTab } from "@/components/profile/tabs/NotificationsTab";
import { SavedAssetsTab } from "@/components/profile/tabs/SavedAssetsTab";
import { resolveDisplayName } from "@/lib/displayName";

const VALID_TABS: ProfileTab[] = ["profile", "saved", "credits", "password", "notifications"];

const ProfilePage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [email, setEmail] = useState("");

  const tabParam = searchParams.get("tab") as ProfileTab | null;
  const activeTab: ProfileTab = tabParam && VALID_TABS.includes(tabParam) ? tabParam : "profile";

  const setActiveTab = (tab: ProfileTab) => {
    const next = new URLSearchParams(searchParams);
    if (tab === "profile") next.delete("tab");
    else next.set("tab", tab);
    setSearchParams(next, { replace: true });
  };

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate("/"); return; }
      setUserId(session.user.id);
      setEmail(session.user.email || session.user.phone || "");

      const { data } = await supabase
        .from("profiles")
        .select("name, agent_info")
        .eq("id", session.user.id)
        .single();

      if (data) {
        setName(data.name || "");
        const agentInfo = data.agent_info as any;
        setAvatarUrl(agentInfo?.profile_picture_url || null);
      }
      setLoading(false);
    };
    fetchProfile();
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast("Đã đăng xuất");
    navigate("/");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 container py-8 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 container py-6 md:py-8">
        <div className="lg:grid lg:grid-cols-12 lg:gap-6">
          <ProfileSidebar
            activeTab={activeTab}
            onChange={setActiveTab}
            name={resolveDisplayName(name, userId)}
            email={email}
            avatarUrl={avatarUrl}
            onLogout={handleLogout}
          />

          <div className="lg:col-span-9">
            {activeTab === "profile" && (
              <ProfileInfoTab
                name={name}
                email={email}
                avatarUrl={avatarUrl}
                onNameChange={setName}
                onAvatarChange={setAvatarUrl}
              />
            )}
            {activeTab === "saved" && <SavedAssetsTab />}
            {activeTab === "credits" && <CreditsTab />}
            {activeTab === "password" && <PasswordTab />}
            {activeTab === "notifications" && <NotificationsTab />}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default ProfilePage;
