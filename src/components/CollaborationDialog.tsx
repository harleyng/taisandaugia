import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Handshake, CheckCircle2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const schema = z.object({
  orgName: z.string().min(2, "Vui lòng nhập tên tổ chức"),
  contactName: z.string().min(2, "Vui lòng nhập tên người liên hệ"),
  phone: z
    .string()
    .min(9, "Số điện thoại không hợp lệ")
    .max(11, "Số điện thoại không hợp lệ")
    .regex(/^[0-9]+$/, "Số điện thoại chỉ gồm chữ số"),
  email: z.string().email("Email không hợp lệ"),
  province: z.string().min(2, "Vui lòng nhập tỉnh / thành phố"),
  note: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface CollaborationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CollaborationDialog({ open, onOpenChange }: CollaborationDialogProps) {
  const [submitted, setSubmitted] = useState(false);
  const { toast } = useToast();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      orgName: "",
      contactName: "",
      phone: "",
      email: "",
      province: "",
      note: "",
    },
  });

  const onSubmit = async (values: FormValues) => {
    // TODO: wire up to Supabase or an API endpoint
    console.log("Collaboration request:", values);
    setSubmitted(true);
  };

  const handleOpenChange = (val: boolean) => {
    if (!val) {
      // reset after close animation
      setTimeout(() => {
        setSubmitted(false);
        form.reset();
      }, 300);
    }
    onOpenChange(val);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {submitted ? (
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <CheckCircle2 className="h-14 w-14 text-green-500" strokeWidth={1.5} />
            <DialogTitle className="text-xl font-semibold">Đã nhận thông tin!</DialogTitle>
            <p className="text-sm text-muted-foreground max-w-xs">
              Cảm ơn bạn đã đăng ký hợp tác. Đội ngũ chúng tôi sẽ liên hệ trong vòng 1–2 ngày làm việc.
            </p>
            <Button onClick={() => handleOpenChange(false)} className="mt-2">
              Đóng
            </Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2 mb-1">
                <Handshake className="h-5 w-5 text-primary" strokeWidth={1.5} />
                <DialogTitle>Đăng ký hợp tác</DialogTitle>
              </div>
              <DialogDescription>
                Điền thông tin bên dưới để trở thành đối tác đấu giá tài sản của chúng tôi.
              </DialogDescription>
            </DialogHeader>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-2">
                <FormField
                  control={form.control}
                  name="orgName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tên tổ chức đấu giá</FormLabel>
                      <FormControl>
                        <Input placeholder="VD: Công ty đấu giá ABC" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="contactName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Người liên hệ</FormLabel>
                        <FormControl>
                          <Input placeholder="Họ và tên" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Số điện thoại</FormLabel>
                        <FormControl>
                          <Input placeholder="0901 234 567" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="contact@company.vn" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="province"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tỉnh / Thành phố</FormLabel>
                        <FormControl>
                          <Input placeholder="VD: Hà Nội" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="note"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ghi chú thêm (tuỳ chọn)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Mô tả ngắn về tổ chức hoặc nhu cầu hợp tác..."
                          className="resize-none"
                          rows={3}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end gap-2 pt-1">
                  <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                    Huỷ
                  </Button>
                  <Button type="submit" disabled={form.formState.isSubmitting}>
                    Gửi đăng ký
                  </Button>
                </div>
              </form>
            </Form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
