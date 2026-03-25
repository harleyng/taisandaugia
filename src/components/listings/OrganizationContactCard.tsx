import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Building2, Phone, Mail, Eye } from "lucide-react";
import { useState } from "react";

interface ContactInfo {
  name: string;
  phone: string;
  email: string;
}

interface OrganizationContactCardProps {
  contactInfo: ContactInfo | null;
  loading: boolean;
  customAttributes?: Record<string, any>;
}

export const OrganizationContactCard = ({ contactInfo, loading, customAttributes }: OrganizationContactCardProps) => {
  const [showPhone, setShowPhone] = useState(false);

  // Fallback to custom_attributes if no listing_contacts record
  const effectiveContact: ContactInfo | null = contactInfo || (customAttributes?.org_name ? {
    name: customAttributes.org_name,
    phone: customAttributes.org_phone || "",
    email: customAttributes.org_email || "",
  } : null);

  return (
    <Card className="p-0 overflow-hidden">
      <div className="bg-muted px-5 py-4 flex items-center gap-2">
        <Building2 className="w-5 h-5 text-foreground" />
        <h2 className="text-lg font-bold text-foreground">Tổ chức đấu giá</h2>
      </div>

      <div className="p-5">
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-5 w-1/2" />
            <Skeleton className="h-5 w-2/3" />
          </div>
        ) : effectiveContact ? (
          <div className="space-y-4">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Tên tổ chức</p>
              <p className="font-semibold text-foreground mt-0.5">{effectiveContact.name || "N/A"}</p>
            </div>

            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Số điện thoại</p>
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
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Email</p>
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
      </div>
    </Card>
  );
};
