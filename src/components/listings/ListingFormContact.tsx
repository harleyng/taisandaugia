import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { contactSchema } from "@/lib/validation";
import { useState } from "react";

interface ListingFormContactProps {
  contactName: string;
  setContactName: (value: string) => void;
  contactPhone: string;
  setContactPhone: (value: string) => void;
  contactEmail: string;
  setContactEmail: (value: string) => void;
}

export const ListingFormContact = ({
  contactName,
  setContactName,
  contactPhone,
  setContactPhone,
  contactEmail,
  setContactEmail,
}: ListingFormContactProps) => {
  const [errors, setErrors] = useState<{ name?: string; phone?: string; email?: string }>({});

  const validateField = (field: 'name' | 'phone' | 'email', value: string) => {
    try {
      if (field === 'name') {
        contactSchema.shape.name.parse(value);
      } else if (field === 'phone') {
        contactSchema.shape.phone.parse(value);
      } else if (field === 'email') {
        contactSchema.shape.email.parse(value);
      }
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    } catch (error: any) {
      setErrors((prev) => ({ ...prev, [field]: error.errors?.[0]?.message }));
    }
  };

  return (
    <div className="space-y-4 p-4 border rounded-lg">
      <h3 className="font-semibold">Thông tin liên hệ</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="contactName">Tên liên hệ <span className="text-destructive">*</span></Label>
          <Input
            id="contactName"
            value={contactName}
            onChange={(e) => {
              const value = e.target.value.slice(0, 100);
              setContactName(value);
              validateField('name', value);
            }}
            onBlur={() => validateField('name', contactName)}
            required
            maxLength={100}
          />
          {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="contactPhone">Số điện thoại <span className="text-destructive">*</span></Label>
          <Input
            id="contactPhone"
            type="tel"
            value={contactPhone}
            onChange={(e) => {
              const value = e.target.value.slice(0, 15);
              setContactPhone(value);
              validateField('phone', value);
            }}
            onBlur={() => validateField('phone', contactPhone)}
            required
            maxLength={15}
          />
          {errors.phone && <p className="text-sm text-destructive">{errors.phone}</p>}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="contactEmail">Email liên hệ <span className="text-destructive">*</span></Label>
        <Input
          id="contactEmail"
          type="email"
          value={contactEmail}
          onChange={(e) => {
            const value = e.target.value.slice(0, 255);
            setContactEmail(value);
            validateField('email', value);
          }}
          onBlur={() => validateField('email', contactEmail)}
          required
          maxLength={255}
        />
        {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
      </div>
    </div>
  );
};
