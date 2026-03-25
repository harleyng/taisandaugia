import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MembershipWithDetails } from "@/types/organization.types";
import { toast } from "sonner";

export const useOrganizationMembers = (orgId: string | null) => {
  const [members, setMembers] = useState<MembershipWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [refetchTrigger, setRefetchTrigger] = useState(0);

  useEffect(() => {
    if (!orgId) {
      setLoading(false);
      return;
    }

    const fetchMembers = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("organization_memberships")
          .select(`
            *,
            role:organization_roles(*),
            user:profiles!organization_memberships_user_id_fkey(id, email, name),
            inviter:profiles!organization_memberships_invited_by_fkey(id, email, name)
          `)
          .eq("organization_id", orgId)
          .order("created_at", { ascending: false });

        if (error) throw error;
        setMembers(data as any);
      } catch (error) {
        console.error("Error fetching members:", error);
        toast.error("Không thể tải danh sách thành viên");
      } finally {
        setLoading(false);
      }
    };

    fetchMembers();
  }, [orgId, refetchTrigger]);

  return { members, loading, refetch: () => setRefetchTrigger(prev => prev + 1) };
};

export const useInviteMember = () => {
  const [inviting, setInviting] = useState(false);

  const inviteMember = async (
    orgId: string,
    email: string,
    roleId: string
  ) => {
    setInviting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error("Vui lòng đăng nhập");

      // Check if user with email exists
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", email)
        .maybeSingle();

      const inviteToken = crypto.randomUUID();

      const membershipData: any = {
        organization_id: orgId,
        role_id: roleId,
        status: "PENDING_INVITE",
        invited_by: session.user.id,
        invite_token: inviteToken,
      };

      if (profiles) {
        // User exists
        membershipData.user_id = profiles.id;
      } else {
        // User doesn't exist - store email for signup
        membershipData.invite_email = email;
      }

      const { error } = await supabase
        .from("organization_memberships")
        .insert(membershipData);

      if (error) throw error;

      toast.success(
        profiles
          ? "Lời mời đã được gửi đến môi giới"
          : "Lời mời đã được tạo. Link đăng ký: /auth?invite=" + inviteToken
      );
      return inviteToken;
    } catch (error: any) {
      console.error("Error inviting member:", error);
      if (error.code === "23505") {
        toast.error("Môi giới này đã là thành viên của tổ chức");
      } else {
        toast.error("Không thể gửi lời mời");
      }
      return null;
    } finally {
      setInviting(false);
    }
  };

  return { inviteMember, inviting };
};

export const useUserPendingInvites = () => {
  const [invites, setInvites] = useState<MembershipWithDetails[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchInvites = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
          setLoading(false);
          return;
        }

        const { data, error } = await supabase
          .from("organization_memberships")
          .select(`
            *,
            organization:organizations(*),
            role:organization_roles(*),
            inviter:profiles!organization_memberships_invited_by_fkey(id, email, name)
          `)
          .eq("user_id", session.user.id)
          .eq("status", "PENDING_INVITE");

        if (error) throw error;
        setInvites(data as any);
      } catch (error) {
        console.error("Error fetching invites:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchInvites();
  }, []);

  return { invites, loading, refetch: () => setLoading(true) };
};

export const useAcceptInvitation = () => {
  const [accepting, setAccepting] = useState(false);

  const acceptInvitation = async (membershipId: string) => {
    setAccepting(true);
    try {
      const { error } = await supabase
        .from("organization_memberships")
        .update({
          status: "ACTIVE",
          joined_at: new Date().toISOString(),
        })
        .eq("id", membershipId);

      if (error) throw error;

      toast.success("Đã chấp nhận lời mời");
      return true;
    } catch (error) {
      console.error("Error accepting invitation:", error);
      toast.error("Không thể chấp nhận lời mời");
      return false;
    } finally {
      setAccepting(false);
    }
  };

  return { acceptInvitation, accepting };
};

export const useDeclineInvitation = () => {
  const [declining, setDeclining] = useState(false);

  const declineInvitation = async (membershipId: string) => {
    setDeclining(true);
    try {
      const { error } = await supabase
        .from("organization_memberships")
        .delete()
        .eq("id", membershipId);

      if (error) throw error;

      toast.success("Đã từ chối lời mời");
      return true;
    } catch (error) {
      console.error("Error declining invitation:", error);
      toast.error("Không thể từ chối lời mời");
      return false;
    } finally {
      setDeclining(false);
    }
  };

  return { declineInvitation, declining };
};

export const useRemoveMember = () => {
  const [removing, setRemoving] = useState(false);

  const removeMember = async (membershipId: string) => {
    setRemoving(true);
    try {
      console.log("Attempting to remove member:", membershipId);
      
      const { data, error } = await supabase
        .from("organization_memberships")
        .delete()
        .eq("id", membershipId)
        .select();

      console.log("Delete result:", { data, error });

      if (error) {
        console.error("Delete error:", error);
        throw error;
      }

      toast.success("Đã xóa thành viên");
      return true;
    } catch (error) {
      console.error("Error removing member:", error);
      toast.error("Không thể xóa thành viên");
      return false;
    } finally {
      setRemoving(false);
    }
  };

  return { removeMember, removing };
};
