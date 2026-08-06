import { Card } from "@/components/ui/card";
import { FileText, Eye, Paperclip } from "lucide-react";
import { useAuthDialog } from "@/contexts/AuthDialogContext";
import { useAuth } from "@/contexts/AuthContext";
import { caRecordArray, caString, type AuctionListing } from "@/types/listing";

// Chỉ nhận đúng trường được đọc — xem chú thích ở AuctionScheduleInfo.
interface AuctionAttachmentsProps {
  listing: Pick<AuctionListing, "custom_attributes">;
}

export const AuctionAttachments = ({ listing }: AuctionAttachmentsProps) => {
  const { openAuthDialog } = useAuthDialog();
  // Dùng AuthContext thay vì tự getSession + onAuthStateChange. Provider sinh ra
  // chính là để gom các subscription trùng lặp kiểu này về một mối.
  const { session } = useAuth();

  const ca = listing.custom_attributes || {};
  const attachments = caRecordArray(ca.attachments).map((file) => ({
    name: caString(file.name) ?? "Tệp đính kèm",
    url: caString(file.url) ?? "",
  }));

  if (attachments.length === 0) return null;

  return (
    <Card className="p-5 space-y-4">
      {/* Header với icon */}
      <div className="flex items-center gap-2">
        <Paperclip className="w-5 h-5 text-primary" />
        <h3 className="text-lg font-bold text-foreground">File đính kèm</h3>
      </div>

      <div className="space-y-2">
        {attachments.map((file, index) =>
        <div
          key={index}
          className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer"
          onClick={() => {
            if (!session) {openAuthDialog();return;}
            window.open(file.url, "_blank", "noopener,noreferrer");
          }}>
          
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="p-2 rounded-md bg-destructive/10 shrink-0">
                <FileText className="w-4 h-4 text-destructive" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {file.name}
                </p>
                

              
              </div>
            </div>
            <Eye className="w-4 h-4 text-muted-foreground shrink-0" />
          </div>
        )}
      </div>
    </Card>);

};