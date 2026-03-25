import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { OrganizationRole, OrganizationRoleName } from "@/types/organization.types";

export const useOrganizationRoles = () => {
  const [roles, setRoles] = useState<OrganizationRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRoles = async () => {
      try {
        const { data, error } = await supabase
          .from("organization_roles")
          .select("*")
          .order("name");

        if (error) throw error;
        setRoles(data as any);
      } catch (error) {
        console.error("Error fetching roles:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchRoles();
  }, []);

  return { roles, loading };
};

export const useUserRoleInOrg = (orgId: string | null) => {
  const [role, setRole] = useState<OrganizationRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orgId) {
      setLoading(false);
      return;
    }

    const fetchUserRole = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
          setLoading(false);
          return;
        }

        const { data, error } = await supabase
          .from("organization_memberships")
          .select(`
            role:organization_roles(*)
          `)
          .eq("organization_id", orgId)
          .eq("user_id", session.user.id)
          .eq("status", "ACTIVE")
          .maybeSingle();

        if (error) throw error;
        setRole(data?.role as any || null);
      } catch (error) {
        console.error("Error fetching user role:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserRole();
  }, [orgId]);

  return { role, loading };
};

export const useUserPermissions = (orgId: string | null) => {
  const { role, loading } = useUserRoleInOrg(orgId);

  const hasPermission = (permission: string): boolean => {
    if (!role) return false;
    if (role.permissions.includes("ALL_PERMISSIONS")) return true;
    return role.permissions.includes(permission);
  };

  const canInvite = (targetRoleName: OrganizationRoleName): boolean => {
    if (!role) return false;
    if (role.name === "Owner") return true;
    if (role.name === "Manager" && targetRoleName === "Agent") return true;
    return false;
  };

  const canRemoveMember = (targetRoleName: OrganizationRoleName): boolean => {
    if (!role) return false;
    if (role.name === "Owner") return true;
    if (role.name === "Manager" && targetRoleName === "Agent") return true;
    return false;
  };

  const canManageOrgListings = (): boolean => {
    if (!role) return false;
    return role.name === "Owner" || role.name === "Manager";
  };

  return {
    role,
    loading,
    hasPermission,
    canInvite,
    canRemoveMember,
    canManageOrgListings,
    isOwner: role?.name === "Owner",
    isManager: role?.name === "Manager",
    isAgent: role?.name === "Agent",
  };
};
