import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PlusCircle } from "lucide-react";
import { ComingSoonOverlay } from "@/components/portal/ComingSoonOverlay";

export default function BrokerCustomers() {
  return (
    <ComingSoonOverlay>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Quản lý khách hàng</h1>
            <p className="text-muted-foreground">Quản lý quan hệ với khách hàng</p>
          </div>
          <Button>
            <PlusCircle className="mr-2 h-4 w-4" />
            Thêm khách hàng
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Danh sách khách hàng</CardTitle>
            <CardDescription>Xem và quản lý cơ sở dữ liệu khách hàng</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Danh sách khách hàng sẽ hiển thị tại đây</p>
          </CardContent>
        </Card>
      </div>
    </ComingSoonOverlay>
  );
}
