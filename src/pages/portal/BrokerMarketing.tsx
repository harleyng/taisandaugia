import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PlusCircle } from "lucide-react";
import { ComingSoonOverlay } from "@/components/portal/ComingSoonOverlay";

export default function BrokerMarketing() {
  return (
    <ComingSoonOverlay>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Quản lý tài trợ</h1>
            <p className="text-muted-foreground">Tạo và quản lý chiến dịch marketing</p>
          </div>
          <Button>
            <PlusCircle className="mr-2 h-4 w-4" />
            Chiến dịch mới
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Chiến dịch của bạn</CardTitle>
            <CardDescription>Theo dõi các chiến dịch marketing</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Danh sách chiến dịch sẽ hiển thị tại đây</p>
          </CardContent>
        </Card>
      </div>
    </ComingSoonOverlay>
  );
}
