import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Building2, Phone, Mail, Eye } from "lucide-react";
import { useState } from "react";
import { SectionLabel } from "@/components/shared/SectionLabel";
import { InfoCardShell } from "@/components/shared/InfoCardShell";
import { caString, type ListingCustomAttributes } from "@/types/listing";

interface ContactInfo {
  name: string;
  phone: string;
  email: string;
}

interface OrganizationContactCardProps {
  contactInfo: ContactInfo | null;
  loading: boolean;
  customAttributes?: ListingCustomAttributes;
}

export const OrganizationContactCard = ({ contactInfo, loading, customAttributes }: OrganizationContactCardProps) => {
  const [showPhone, setShowPhone] = useState(false);

  // Fallback to custom_attributes if no listing_contacts record
  const caOrgName = caString(customAttributes?.org_name);
  const effectiveContact: ContactInfo | null = contactInfo || (caOrgName ? {
    name: caOrgName,
    phone: caString(customAttributes?.org_phone) || "",
    email: caString(customAttributes?.org_email) || "",
  } : null);

  return (
    <InfoCardShell
      title="Tổ chức đấu giá"
      icon={<Building2 className="w-5 h-5 text-foreground" />}
    >
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-5 w-1/2" />
            <Skeleton className="h-5 w-2/3" />
          </div>
        ) : effectiveContact ? (
          <div className="space-y-4">
            <div>
              <SectionLabel>Tên tổ chức</SectionLabel>
              <p className="font-semibold text-foreground mt-0.5">{effectiveContact.name || "N/A"}</p>
            </div>

            <div>
              <SectionLabel>Số điện thoại</SectionLabel>
              <div className="flex items-center gap-2 mt-0.5">
                <p className="font-medium text-foreground">
                  {showPhone
                    ? effectiveContact.phone
                    : effectiveContact.phone
                      ? `****${effectiveContact.phone.slice(-3)}`
                      : "N/A"}
                </p>
                {!showPhone && effectiveContact.phone && (
                  <Button variant="ghost" size="sm" onClick={() => setShowPhone(true)} className="h-6 px-2 text-xs">
                    <Eye className="w-3 h-3 mr-1" />
                    Hiện
                  </Button>
                )}
              </div>
            </div>

            <div>
              <SectionLabel>Email</SectionLabel>
              <p className="font-medium text-foreground text-sm mt-0.5">{effectiveContact.email || "N/A"}</p>
            </div>

            <div className="pt-2 space-y-2">
              <Button
                className="w-full"
                onClick={() => effectiveContact.phone && window.open(`tel:${effectiveContact.phone}`)}
                disabled={!effectiveContact.phone}
              >
                <Phone className="w-4 h-4 mr-2" />
                Gọi điện
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => effectiveContact.email && window.open(`mailto:${effectiveContact.email}`)}
                disabled={!effectiveContact.email}
              >
                <Mail className="w-4 h-4 mr-2" />
                Gửi email
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-muted-foreground text-center py-4 text-sm">
            Không có thông tin tổ chức đấu giá
          </p>
        )}
    </InfoCardShell>
  );
};
