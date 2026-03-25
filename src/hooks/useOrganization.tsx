import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Organization, LicenseInfo } from "@/types/organization.types";
import { toast } from "sonner";

export const useUserOrganizations = () => {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrganizations = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
          setLoading(false);
          return;
        }

        const { data, error } = await supabase
          .from("organization_memberships")
          .select(`
            organization:organizations(*)
          `)
          .eq("user_id", session.user.id)
          .eq("status", "ACTIVE");

        if (error) throw error;

        const orgs = data?.map(item => item.organization).filter(Boolean) as Organization[];
        setOrganizations(orgs);
      } catch (error) {
        console.error("Error fetching organizations:", error);
        toast.error("Không thể tải danh sách tổ chức");
      } finally {
        setLoading(false);
      }
    };

    fetchOrganizations();
  }, []);

  return { organizations, loading };
};

export const useOrganizationDetails = (orgId: string | null) => {
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orgId) {
      setLoading(false);
      return;
    }

    const fetchOrganization = async () => {
      try {
        const { data, error } = await supabase
          .from("organizations")
          .select("*")
          .eq("id", orgId)
          .single();

        if (error) throw error;
        setOrganization(data);
      } catch (error) {
        console.error("Error fetching organization:", error);
        toast.error("Không thể tải thông tin tổ chức");
      } finally {
        setLoading(false);
      }
    };

    fetchOrganization();
  }, [orgId]);

  return { organization, loading };
};

export const useCreateOrganization = () => {
  const [creating, setCreating] = useState(false);

  const createOrganization = async (name: string, licenseInfo: LicenseInfo) => {
    setCreating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        throw new Error("Vui lòng đăng nhập");
      }

      // Check if user has APPROVED individual KYC
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("kyc_status")
        .eq("id", session.user.id)
        .single();

      if (profileError) throw profileError;

      if (profile.kyc_status !== "APPROVED") {
        toast.error("Bạn cần hoàn thành KYC cá nhân trước khi tạo tổ chức");
        return null;
      }

      const { data, error } = await supabase
        .from("organizations")
        .insert({
          name,
          owner_id: session.user.id,
          license_info: licenseInfo as any,
          kyc_status: "PENDING_KYC",
        })
        .select()
        .single();

      if (error) throw error;

      toast.success("Tạo tổ chức thành công! Đang chờ admin duyệt.");
      return data as any;
    } catch (error) {
      console.error("Error creating organization:", error);
      toast.error("Không thể tạo tổ chức");
      return null;
    } finally {
      setCreating(false);
    }
  };

  return { createOrganization, creating };
};

export const useUpdateOrganization = () => {
  const [updating, setUpdating] = useState(false);

  const updateOrganization = async (
    orgId: string,
    updates: { name?: string; license_info?: LicenseInfo }
  ) => {
    setUpdating(true);
    try {
      const { error } = await supabase
        .from("organizations")
        .update(updates as any)
        .eq("id", orgId);

      if (error) throw error;

      toast.success("Cập nhật tổ chức thành công");
      return true;
    } catch (error) {
      console.error("Error updating organization:", error);
      toast.error("Không thể cập nhật tổ chức");
      return false;
    } finally {
      setUpdating(false);
    }
  };

  return { updateOrganization, updating };
};
