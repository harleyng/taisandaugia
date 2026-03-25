import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, AlertCircle, CheckCircle, Info } from "lucide-react";
import { Session } from "@supabase/supabase-js";

interface AgentInfo {
  companyName?: string;
  licenseNumber?: string;
  businessAddress?: string;
  companyPhone?: string;
  website?: string;
  profilePicture?: string;
  licenseDocument?: string;
}

interface Profile {
  kyc_status: "NOT_APPLIED" | "PENDING_KYC" | "APPROVED" | "REJECTED";
  agent_info: any;
  rejection_reason: string | null;
}

export default function BrokerProfile() {
  const { toast } = useToast();
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [profilePictureFile, setProfilePictureFile] = useState<File | null>(null);
  const [licenseDocumentFile, setLicenseDocumentFile] = useState<File | null>(null);

  const [formData, setFormData] = useState<AgentInfo>({
    companyName: "",
    licenseNumber: "",
    businessAddress: "",
    companyPhone: "",
    website: "",
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        loadProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("kyc_status, agent_info, rejection_reason")
        .eq("id", userId)
        .single();

      if (error) throw error;

      setProfile(data);
      if (data.agent_info && typeof data.agent_info === 'object') {
        const agentInfo = data.agent_info as AgentInfo;
        setFormData({
          companyName: agentInfo.companyName || "",
          licenseNumber: agentInfo.licenseNumber || "",
          businessAddress: agentInfo.businessAddress || "",
          companyPhone: agentInfo.companyPhone || "",
          website: agentInfo.website || "",
        });
      }
    } catch (error) {
      console.error("Error loading profile:", error);
      toast({
        title: "Lỗi",
        description: "Không thể tải thông tin hồ sơ",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const uploadFile = async (file: File, bucket: string, path: string): Promise<string> => {
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(path, file, { upsert: true });

    if (error) throw error;

    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(data.path);

    return publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!session) return;

    if (!formData.companyName || !formData.businessAddress) {
      toast({
        title: "Thiếu thông tin",
        description: "Vui lòng điền đầy đủ các trường bắt buộc",
        variant: "destructive",
      });
      return;
    }

    if (profile?.kyc_status === "NOT_APPLIED") {
      if (!profilePictureFile || !licenseDocumentFile) {
        toast({
          title: "Thiếu tài liệu",
          description: "Vui lòng tải lên ảnh chân dung và giấy phép kinh doanh",
          variant: "destructive",
        });
        return;
      }
    }

    setSubmitting(true);

    try {
      const updatedAgentInfo: AgentInfo = { ...formData };

      if (profilePictureFile) {
        const picturePath = `${session.user.id}/profile-picture-${Date.now()}`;
        updatedAgentInfo.profilePicture = await uploadFile(profilePictureFile, "listing-images", picturePath);
      } else if (profile?.agent_info?.profilePicture) {
        updatedAgentInfo.profilePicture = profile.agent_info.profilePicture;
      }

      if (licenseDocumentFile) {
        const documentPath = `${session.user.id}/license-document-${Date.now()}`;
        updatedAgentInfo.licenseDocument = await uploadFile(licenseDocumentFile, "listing-images", documentPath);
      } else if (profile?.agent_info?.licenseDocument) {
        updatedAgentInfo.licenseDocument = profile.agent_info.licenseDocument;
      }

      const { error } = await supabase
        .from("profiles")
        .update({
          kyc_status: "PENDING_KYC" as const,
          agent_info: updatedAgentInfo as any,
          rejection_reason: null,
        })
        .eq("id", session.user.id);

      if (error) throw error;

      toast({
        title: "Thành công",
        description: "Hồ sơ đăng ký môi giới đã được gửi. Chúng tôi sẽ xem xét và thông báo kết quả sớm nhất.",
      });

      await loadProfile(session.user.id);
    } catch (error) {
      console.error("Error submitting registration:", error);
      toast({
        title: "Lỗi",
        description: "Không thể gửi hồ sơ đăng ký. Vui lòng thử lại.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Hồ sơ cá nhân</h1>
        <p className="text-muted-foreground">Quản lý thông tin và trạng thái xác thực môi giới</p>
      </div>

      {/* Status Alerts */}
      {profile?.kyc_status === "REJECTED" && profile.rejection_reason && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Hồ sơ bị từ chối</AlertTitle>
          <AlertDescription>
            {profile.rejection_reason}
            <br />
            <span className="text-sm mt-2 block">Vui lòng chỉnh sửa thông tin và gửi lại.</span>
          </AlertDescription>
        </Alert>
      )}

      {profile?.kyc_status === "PENDING_KYC" && (
        <Alert className="border-blue-200 bg-blue-50">
          <Info className="h-4 w-4 text-blue-600" />
          <AlertTitle className="text-blue-800">Hồ sơ đang chờ duyệt</AlertTitle>
          <AlertDescription className="text-blue-700">
            Hồ sơ đăng ký môi giới của bạn đang được xem xét. Chúng tôi sẽ thông báo kết quả sớm nhất.
          </AlertDescription>
        </Alert>
      )}

      {profile?.kyc_status === "APPROVED" && (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertTitle className="text-green-800">Xác thực thành công</AlertTitle>
          <AlertDescription className="text-green-700">
            Hồ sơ môi giới của bạn đã được duyệt. Bạn có thể sử dụng đầy đủ các tính năng của broker.
          </AlertDescription>
        </Alert>
      )}

      {/* Registration Form */}
      {profile?.kyc_status !== "APPROVED" ? (
        <Card>
          <CardHeader>
            <CardTitle>Đăng ký môi giới</CardTitle>
            <CardDescription>
              Vui lòng điền đầy đủ thông tin để chúng tôi xét duyệt hồ sơ của bạn
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="companyName">
                  Tên công ty/sàn giao dịch <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="companyName"
                  value={formData.companyName}
                  onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                  required
                  disabled={submitting}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="licenseNumber">Mã số giấy phép môi giới (nếu có)</Label>
                <Input
                  id="licenseNumber"
                  value={formData.licenseNumber}
                  onChange={(e) => setFormData({ ...formData, licenseNumber: e.target.value })}
                  disabled={submitting}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="businessAddress">
                  Địa chỉ văn phòng <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="businessAddress"
                  value={formData.businessAddress}
                  onChange={(e) => setFormData({ ...formData, businessAddress: e.target.value })}
                  required
                  disabled={submitting}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="companyPhone">Số điện thoại công ty</Label>
                <Input
                  id="companyPhone"
                  type="tel"
                  value={formData.companyPhone}
                  onChange={(e) => setFormData({ ...formData, companyPhone: e.target.value })}
                  disabled={submitting}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="website">Website (nếu có)</Label>
                <Input
                  id="website"
                  type="url"
                  value={formData.website}
                  onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                  placeholder="https://"
                  disabled={submitting}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="profilePicture">
                  Ảnh chân dung {profile?.kyc_status === "NOT_APPLIED" && <span className="text-destructive">*</span>}
                </Label>
                {profile?.agent_info?.profilePicture && (
                  <div className="mb-2">
                    <img 
                      src={profile.agent_info.profilePicture} 
                      alt="Profile" 
                      className="w-32 h-32 object-cover rounded-lg"
                    />
                  </div>
                )}
                <Input
                  id="profilePicture"
                  type="file"
                  accept="image/*"
                  onChange={(e) => setProfilePictureFile(e.target.files?.[0] || null)}
                  required={profile?.kyc_status === "NOT_APPLIED"}
                  disabled={submitting}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="licenseDocument">
                  Ảnh giấy phép kinh doanh/chứng chỉ môi giới {profile?.kyc_status === "NOT_APPLIED" && <span className="text-destructive">*</span>}
                </Label>
                {profile?.agent_info?.licenseDocument && (
                  <div className="mb-2">
                    <img 
                      src={profile.agent_info.licenseDocument} 
                      alt="License" 
                      className="w-full max-w-md object-contain rounded-lg border"
                    />
                  </div>
                )}
                <Input
                  id="licenseDocument"
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) => setLicenseDocumentFile(e.target.files?.[0] || null)}
                  required={profile?.kyc_status === "NOT_APPLIED"}
                  disabled={submitting}
                />
              </div>

              <Button type="submit" disabled={submitting} className="w-full">
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Đang gửi...
                  </>
                ) : (
                  "Gửi hồ sơ đăng ký"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Thông tin môi giới</CardTitle>
            <CardDescription>Hồ sơ đã được xác thực</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {profile?.agent_info?.profilePicture && (
              <div>
                <Label>Ảnh đại diện</Label>
                <img 
                  src={profile.agent_info.profilePicture} 
                  alt="Profile" 
                  className="w-32 h-32 object-cover rounded-lg mt-2"
                />
              </div>
            )}
            <div>
              <Label>Tên công ty/sàn giao dịch</Label>
              <p className="text-foreground mt-1">{profile?.agent_info?.companyName}</p>
            </div>
            {profile?.agent_info?.licenseNumber && (
              <div>
                <Label>Mã số giấy phép</Label>
                <p className="text-foreground mt-1">{profile.agent_info.licenseNumber}</p>
              </div>
            )}
            <div>
              <Label>Địa chỉ văn phòng</Label>
              <p className="text-foreground mt-1">{profile?.agent_info?.businessAddress}</p>
            </div>
            {profile?.agent_info?.companyPhone && (
              <div>
                <Label>Số điện thoại</Label>
                <p className="text-foreground mt-1">{profile.agent_info.companyPhone}</p>
              </div>
            )}
            {profile?.agent_info?.website && (
              <div>
                <Label>Website</Label>
                <p className="text-foreground mt-1">
                  <a href={profile.agent_info.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                    {profile.agent_info.website}
                  </a>
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
