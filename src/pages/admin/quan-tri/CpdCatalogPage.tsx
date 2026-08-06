import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTriangle } from "lucide-react";
import { useCpdCatalog } from "@/hooks/useCpdCatalog";
import { useHasAdminPermission } from "@/hooks/useAdminPermissions";
import { ActivityTypeTable } from "@/components/admin/quan-tri/cpd/ActivityTypeTable";
import { ExemptionReasonTable } from "@/components/admin/quan-tri/cpd/ExemptionReasonTable";

/**
 * Danh mục bồi dưỡng đấu giá viên — nơi định nghĩa CÁCH TÍNH nghĩa vụ bồi dưỡng
 * cho toàn sàn. Trước đây bộ quy tắc này là hằng số trong code; đưa ra đây vì nó
 * đổi theo văn bản pháp lý và vì cùng một hoạt động được tính khác nhau tuỳ vai
 * trò (báo cáo viên hội thảo ≠ người dự hội thảo).
 */
export default function CpdCatalogPage() {
  const { catalog, isLoading } = useCpdCatalog();
  const canEdit = useHasAdminPermission("dm-boi-duong", "update");

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Bồi dưỡng ĐGV</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Danh mục hình thức bồi dưỡng, cách quy đổi giờ và các trường hợp được
          miễn. Cấu hình ở đây áp cho mọi tổ chức đấu giá trên sàn khi khai báo
          nghĩa vụ bồi dưỡng theo Thông tư 19/2024/TT-BTP.
        </p>
      </div>

      {/* Hệ quả của lựa chọn "không snapshot": kết quả chấm luôn tính lại theo
          danh mục hiện hành, nên sửa quy đổi làm đổi cả số liệu năm cũ. Nói
          trước, đừng để admin phát hiện qua một báo cáo lệch. */}
      <div className="flex items-start gap-2.5 rounded-xl border border-warning/40 bg-warning/5 p-3">
        <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground">
          Thay đổi cách tính <strong className="text-foreground">áp dụng hồi tố</strong>:
          hệ thống luôn chấm lại theo danh mục hiện hành, kể cả các năm đã kết thúc.
          Sửa số giờ quy đổi có thể làm đổi kết luận tuân thủ trên báo cáo cũ.
        </p>
      </div>

      {isLoading ? (
        <div className="h-48 rounded-xl bg-muted animate-pulse" />
      ) : (
        <Tabs defaultValue="hinh-thuc">
          <TabsList>
            <TabsTrigger value="hinh-thuc">Hình thức bồi dưỡng</TabsTrigger>
            <TabsTrigger value="mien">Trường hợp được miễn</TabsTrigger>
          </TabsList>

          <TabsContent value="hinh-thuc" className="mt-4">
            <ActivityTypeTable types={catalog.activityTypes} canEdit={canEdit} />
          </TabsContent>

          <TabsContent value="mien" className="mt-4">
            <ExemptionReasonTable reasons={catalog.exemptionReasons} canEdit={canEdit} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
