import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useCreateOrganization } from "@/hooks/useOrganization";
import { useKycStatus } from "@/hooks/useKycStatus";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Building2 } from "lucide-react";
import { organizationSchema } from "@/lib/validation";
import type { z } from "zod";

type OrganizationFormData = z.infer<typeof organizationSchema>;

export default function CreateOrganization() {
  const navigate = useNavigate();
  const { createOrganization, creating } = useCreateOrganization();
  const { kycStatus } = useKycStatus();
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<OrganizationFormData>({
    resolver: zodResolver(organizationSchema),
  });

  const onSubmit = async (data: OrganizationFormData) => {
    if (kycStatus !== "APPROVED") {
      toast.error("Bạn cần hoàn thành KYC cá nhân trước khi tạo tổ chức");
      return;
    }

    setSubmitting(true);
    const licenseInfo = {
      taxId: data.taxId,
      businessLicenseNumber: data.businessLicenseNumber,
      address: data.address,
      legalRepresentative: data.legalRepresentative,
      phoneNumber: data.phoneNumber,
      registrationDate: data.registrationDate,
    };

    const result = await createOrganization(data.name, licenseInfo);
    setSubmitting(false);

    if (result) {
      navigate("/broker/organization");
    }
  };

  if (kycStatus !== "APPROVED") {
    return (
      <div className="container max-w-2xl py-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Bạn cần hoàn thành KYC cá nhân trước khi tạo tổ chức.
            <Button
              variant="link"
              className="ml-2 p-0 h-auto"
              onClick={() => navigate("/broker/profile")}
            >
              Đến trang KYC
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container max-w-3xl py-8">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Building2 className="h-6 w-6 text-primary" />
            <div>
              <CardTitle>Tạo tổ chức mới</CardTitle>
              <CardDescription>
                Điền thông tin tổ chức của bạn để gửi yêu cầu duyệt
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Tên tổ chức *</Label>
              <Input
                id="name"
                {...register("name")}
                placeholder="Sàn Bất Động Sản ABC"
              />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name.message}</p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="taxId">Mã số thuế *</Label>
                <Input
                  id="taxId"
                  {...register("taxId")}
                  placeholder="0123456789"
                />
                {errors.taxId && (
                  <p className="text-sm text-destructive">{errors.taxId.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="businessLicenseNumber">Số giấy phép kinh doanh *</Label>
                <Input
                  id="businessLicenseNumber"
                  {...register("businessLicenseNumber")}
                  placeholder="0123456789"
                />
                {errors.businessLicenseNumber && (
                  <p className="text-sm text-destructive">
                    {errors.businessLicenseNumber.message}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Địa chỉ trụ sở *</Label>
              <Input
                id="address"
                {...register("address")}
                placeholder="123 Đường ABC, Quận 1, TP.HCM"
              />
              {errors.address && (
                <p className="text-sm text-destructive">{errors.address.message}</p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="legalRepresentative">Người đại diện pháp luật *</Label>
                <Input
                  id="legalRepresentative"
                  {...register("legalRepresentative")}
                  placeholder="Nguyễn Văn A"
                />
                {errors.legalRepresentative && (
                  <p className="text-sm text-destructive">
                    {errors.legalRepresentative.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="phoneNumber">Số điện thoại *</Label>
                <Input
                  id="phoneNumber"
                  {...register("phoneNumber")}
                  placeholder="0901234567"
                />
                {errors.phoneNumber && (
                  <p className="text-sm text-destructive">
                    {errors.phoneNumber.message}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="registrationDate">Ngày đăng ký (tùy chọn)</Label>
              <Input
                id="registrationDate"
                type="date"
                {...register("registrationDate")}
              />
            </div>

            <div className="flex gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate("/broker/organization")}
                disabled={submitting || creating}
              >
                Hủy
              </Button>
              <Button type="submit" disabled={submitting || creating}>
                {submitting || creating ? "Đang xử lý..." : "Tạo tổ chức"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
