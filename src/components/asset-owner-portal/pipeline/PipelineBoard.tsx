import { PIPELINE_BRANCH_STAGES, type PipelineBoardData, type PipelineColumnData } from "@/lib/ownerPipeline";
import { PipelineColumn } from "./PipelineColumn";

function ColumnGroup({ caption, columns }: { caption: string; columns: PipelineColumnData[] }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="px-1 text-xs text-muted-foreground">{caption}</p>
      <div className="flex items-start gap-3">
        {columns.map((c) => (
          <PipelineColumn key={c.stage} column={c} />
        ))}
      </div>
    </div>
  );
}

/**
 * Bảng chỉ xem (không kéo thả). Cuộn ngang BÊN TRONG vùng của bảng — trang không
 * bao giờ cuộn ngang; vùng nhận focus để cuộn bằng phím mũi tên. `relative` là bắt
 * buộc: thiếu nó, phần tử absolute bên trong (chữ sr-only "quá hạn") lấy khối chứa
 * là cả trang, thoát khỏi vùng cuộn và kéo trang rộng ra (đo được 1513px ở 390px).
 */
export function PipelineBoard({ board }: { board: PipelineBoardData }) {
  const main = board.columns.filter((c) => !PIPELINE_BRANCH_STAGES.includes(c.stage));
  const branch = board.columns.filter((c) => PIPELINE_BRANCH_STAGES.includes(c.stage));

  return (
    <div
      role="region"
      aria-label="Tài sản theo giai đoạn"
      tabIndex={0}
      className="relative -mx-4 snap-x snap-proximity scroll-px-4 overflow-x-auto px-4 pb-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:mx-0 sm:scroll-px-0 sm:rounded-2xl sm:px-0"
    >
      <div className="flex w-max items-start gap-3">
        <ColumnGroup caption="Luồng chính" columns={main} />
        <div className="border-l border-dashed border-border pl-3">
          <ColumnGroup caption="Nhánh không thành" columns={branch} />
        </div>
      </div>
    </div>
  );
}
