import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
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
import { CompanyTab } from "@/components/profile/tabs/CompanyTab";
import { MyAssetsTab } from "@/components/profile/tabs/MyAssetsTab";
import { resolveDisplayName } from "@/lib/displayName";

const VALID_TABS: ProfileTab[] = ["profile", "saved", "credits", "password", "notifications", "company", "my-assets"];

const ProfilePage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { session, loading: authLoading } = useAuth();
  const userId = session?.user?.id ?? null;
  const email = session?.user?.email || session?.user?.phone || "";
  const { data: profile, isLoading: profileLoading } = useProfile(userId);

  const [name, setName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const tabParam = searchParams.get("tab") as ProfileTab | null;
  const fromParam = searchParams.get("from");
  const activeTab: ProfileTab = tabParam && VALID_TABS.includes(tabParam) ? tabParam : "profile";
  // When viewing saved assets via notifications, keep the Notifications nav highlighted
  const highlightedTab: ProfileTab =
    activeTab === "saved" && fromParam === "notifications" ? "notifications" : activeTab;

  const setActiveTab = (tab: ProfileTab) => {
    const next = new URLSearchParams(searchParams);
    next.delete("from");
    if (tab === "profile") next.delete("tab");
    else next.set("tab", tab);
    setSearchParams(next, { replace: true });
  };

  // Seed editable local state từ query profile dùng chung
  useEffect(() => {
    if (profile) {
      setName(profile.name || "");
      setAvatarUrl(profile.agentInfo?.profile_picture_url ?? null);
    }
  }, [profile]);

  // Chưa đăng nhập → đưa về trang chủ (sau khi auth đã resolve)
  useEffect(() => {
    if (!authLoading && !session) navigate("/");
  }, [authLoading, session, navigate]);

  const loading = authLoading || !session || profileLoading;

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
            activeTab={highlightedTab}
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
            {activeTab === "saved" && <SavedAssetsTab fromNotifications={fromParam === "notifications"} />}
            {activeTab === "credits" && <CreditsTab />}
            {activeTab === "password" && <PasswordTab />}
            {activeTab === "notifications" && <NotificationsTab />}
            {activeTab === "company" && <CompanyTab />}
            {activeTab === "my-assets" && <MyAssetsTab userId={userId} />}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default ProfilePage;
