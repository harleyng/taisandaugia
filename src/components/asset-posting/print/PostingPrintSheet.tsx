import { format } from "date-fns";
import type { PostingPrintData } from "@/hooks/usePostingPrintData";
import { POSTING_PRINT_CSS } from "./postingPrintCss";
import { PrintCover } from "./PrintCover";
import { PrintLegalStatusSection, PrintSpecsSection } from "./PrintAssetSections";
import { PrintAuctionConsultSection, PrintLegalReviewSection } from "./PrintConsultSections";
import { PrintMediaSection, PrintVerifyBox } from "./PrintMediaSection";

interface PostingPrintSheetProps {
  data: PostingPrintData;
  exportedAt: Date;
}

/**
 * Bản in A4 "Hồ sơ số hoá tài sản" theo thiết kế "Ho So So Hoa - PDF" (project 979d4c55).
 * Đầu / chân trang nằm trong thead / tfoot của bảng khung ⇒ lặp trên mọi trang in.
 */
export function PostingPrintSheet({ data, exportedAt }: PostingPrintSheetProps) {
  return (
    <div className="hsp desk">
      <style>{POSTING_PRINT_CSS}</style>
      <div className="sheet">
        <table className="frame" role="presentation">
          <thead>
            <tr>
              <th>
                <div className="hdr-space">
                  <div className="hd">
                    <span className="br">
                      <i />
                      Tài Sản Đấu Giá
                    </span>
                    <span>
                      Hồ sơ số hoá tài sản · <span className="mono">{data.posting.code}</span>
                    </span>
                  </div>
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <div className="doc">
                  <PrintCover data={data} />
                  <PrintSpecsSection data={data} />
                  <PrintLegalStatusSection data={data} />
                  <PrintLegalReviewSection data={data} />
                  <PrintMediaSection data={data} />
                  <PrintAuctionConsultSection data={data} />
                  <PrintVerifyBox data={data} />
                </div>
              </td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td>
                <div className="ftr-space">
                  <div className="ft">
                    <span>Tài liệu xuất từ Cổng Chủ tài sản · taisandaugia.vn</span>
                    <span>Xuất lúc {format(exportedAt, "HH:mm, dd/MM/yyyy")}</span>
                  </div>
                </div>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
