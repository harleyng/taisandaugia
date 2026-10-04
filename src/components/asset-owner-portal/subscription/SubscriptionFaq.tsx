import { Link } from "react-router-dom";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { EXPIRY_WARNING_DAYS } from "@/lib/ownerSubscription/status";
import type { OwnerSubTermOption } from "@/lib/ownerSubscription/types";

/** "Đăng ký 6 tháng giảm 5%, 12 tháng giảm 10%" — theo kỳ đang bán, không cố định. */
function discountAnswer(terms: OwnerSubTermOption[]): string {
  const offers = terms.filter((t) => t.discount_pct > 0).map((t) => `${t.months} tháng giảm ${Number(t.discount_pct)}%`);
  const tail = "Mức giảm hiện ngay trên thẻ gói khi chọn kỳ; giá chưa gồm VAT.";
  return offers.length > 0
    ? `Đăng ký ${offers.join(", ")} so với giá theo tháng. ${tail}`
    : `Kỳ dài hơn có thể được giảm giá so với giá theo tháng. ${tail}`;
}

/** Câu trả lời bám luật gói hiện hành (business-rules "Gói thuê bao tổ chức chủ tài sản"). */
const faqs = (terms: OwnerSubTermOption[]) => [
  {
    q: "Hạn mức được dùng chung như thế nào?",
    a: "Mọi thành viên của Trạm dùng chung một hạn mức trong gói. Hạn mức làm mới vào ngày 01 hằng tháng; phần chưa dùng không cộng dồn sang tháng sau.",
  },
  {
    q: "Hết hạn mức giữa tháng thì sao?",
    a: "Tuỳ cấu hình của gói: thao tác bị chặn tới kỳ làm mới (hoặc khi gia hạn / nâng hạn mức), hoặc vẫn chạy và trừ credit của người thao tác.",
  },
  {
    q: "Đổi gói có hiệu lực khi nào?",
    a: "Gói mới có hiệu lực từ kỳ kế tiếp — gói hiện tại vẫn dùng tới hết kỳ. Mỗi lần chỉ đặt trước được một lần đổi gói; chỉ Trưởng đơn vị đổi được gói.",
  },
  {
    q: "Gia hạn sớm có mất ngày còn lại không?",
    a: `Không. Kỳ mới nối tiếp ngay sau ngày hết hạn của kỳ hiện tại, nên ngày còn lại được giữ nguyên. Trang sẽ nhắc khi gói còn ${EXPIRY_WARNING_DAYS} ngày.`,
  },
  {
    q: "Ưu đãi khi đăng ký 6 hoặc 12 tháng?",
    a: discountAnswer(terms),
  },
  {
    q: "Gói hết hạn thì dữ liệu có bị mất?",
    a: "Không. Hồ sơ, báo cáo và dữ liệu của Trạm được giữ nguyên. Chỉ hạn mức gói ngừng áp dụng — thành viên trả credit cho các tính năng tính phí cho tới khi gia hạn.",
  },
  {
    q: "Có xuất hoá đơn VAT không?",
    a: "Có. Giá gói chưa gồm VAT. Sau khi thanh toán, liên hệ sàn kèm mã gói và thông tin xuất hoá đơn của tổ chức để nhận hoá đơn VAT.",
  },
];

/** "Câu hỏi thường gặp" dưới danh mục gói — cột trái tiêu đề + lối liên hệ, cột phải accordion. */
export function SubscriptionFaq({ terms = [] }: { terms?: OwnerSubTermOption[] }) {
  return (
    <section className="grid gap-6 border-t pt-8 min-[900px]:grid-cols-[minmax(0,5fr)_minmax(0,8fr)] min-[900px]:gap-10">
      <div className="min-[900px]:pt-5">
        <h2 className="text-[22px] font-bold leading-tight tracking-[-0.01em]">Câu hỏi thường gặp</h2>
        <p className="mt-2.5 text-[14.5px] text-muted-foreground">
          Chưa thấy câu trả lời?{" "}
          <Link to="/lien-he" className="text-primary hover:underline">
            Liên hệ sàn
          </Link>{" "}
          để được hỗ trợ.
        </p>
      </div>

      <Accordion type="single" collapsible defaultValue="faq-0" className="rounded-2xl bg-card px-6 py-1.5 shadow-sm">
        {faqs(terms).map((f, i) => (
          <AccordionItem key={f.q} value={`faq-${i}`} className="last:border-b-0">
            <AccordionTrigger className="gap-4 py-[18px] text-left text-[15px] font-semibold hover:no-underline">
              {f.q}
            </AccordionTrigger>
            <AccordionContent className="pr-8 text-[14px] leading-relaxed text-muted-foreground">{f.a}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
}
