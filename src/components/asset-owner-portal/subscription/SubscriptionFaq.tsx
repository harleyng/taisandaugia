import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { EXPIRY_WARNING_DAYS } from "@/lib/ownerSubscription/status";
import { HOTLINES } from "@/constants/hotlines";

/** Câu trả lời bám luật gói hiện hành (business-rules "Gói thuê bao tổ chức chủ tài sản"). */
const FAQS = [
  {
    q: "Gói dịch vụ cung cấp quyền lợi hàng tháng như thế nào?",
    a: "Mỗi tháng, Trạm có hạn mức riêng cho từng tính năng trong gói (quét 3D, báo cáo danh mục…). Hạn mức làm mới vào ngày 01 hằng tháng; phần chưa dùng không cộng dồn sang tháng sau.",
  },
  {
    q: "Ai trong Trạm được dùng quyền lợi của gói?",
    a: "Mọi thành viên trực tiếp của Trạm dùng chung hạn mức trong gói. Trạm chi nhánh không được gói của trụ sở bao — người xem Trạm qua liên kết trụ sở vẫn trả credit như bình thường.",
  },
  {
    q: "Hết hạn mức giữa tháng thì sao?",
    a: "Tuỳ cấu hình của gói: thao tác bị chặn tới kỳ làm mới (hoặc khi gia hạn / nâng hạn mức), hoặc vẫn chạy và trừ credit của người thao tác.",
  },
  {
    q: "Gói dịch vụ của tôi sẽ gia hạn như thế nào?",
    a: `Gói không tự gia hạn. Trưởng đơn vị bấm "Gia hạn" ở trang Gói dịch vụ và thanh toán — kỳ mới nối tiếp ngay sau kỳ hiện tại, không bị gián đoạn. Trang sẽ nhắc khi gói còn ${EXPIRY_WARNING_DAYS} ngày.`,
  },
  {
    q: "Tôi có thể đổi sang gói khác không?",
    a: "Có. Trưởng đơn vị chọn gói mới trong danh mục; gói mới có hiệu lực từ kỳ kế tiếp, gói hiện tại vẫn dùng tới hết kỳ.",
  },
  {
    q: "Tôi có thể huỷ gói dịch vụ nếu không cần nữa không?",
    a: "Có — vui lòng liên hệ sàn qua hotline. Huỷ gói không tự hoàn tiền phần kỳ còn lại; sau khi huỷ, thành viên dùng credit cho các tính năng tính phí.",
  },
  {
    q: "Trạm có thể mua bao nhiêu gói trong một thời điểm?",
    a: "Mỗi Trạm chỉ có một gói hiệu lực tại một thời điểm. Gói mua thêm (gia hạn hoặc đổi gói) được xếp nối tiếp sau kỳ hiện tại.",
  },
  {
    q: "Dịch vụ nào không nằm trong gói?",
    a: "Các dịch vụ tính bằng VND như VR tour, giám định, tư vấn pháp lý và tư vấn đấu giá được báo giá và thanh toán riêng, không trừ vào hạn mức gói.",
  },
];

/** "Hỏi đáp về Gói dịch vụ" — cột trái tiêu đề + hotline, cột phải accordion câu hỏi. */
export function SubscriptionFaq() {
  return (
    <section className="grid gap-6 rounded-2xl border bg-card px-[22px] py-6 min-[900px]:grid-cols-[minmax(0,5fr)_minmax(0,8fr)] min-[900px]:gap-10 min-[900px]:px-8 min-[900px]:py-8">
      <div className="flex flex-col items-start gap-4">
        <h2 className="text-[26px] font-bold leading-tight tracking-[-0.02em]">
          Hỏi đáp về
          <br />
          Gói dịch vụ
        </h2>
        <div className="rounded-xl border px-4 py-3">
          <p className="text-[15px] font-semibold text-primary">
            Hotline{" "}
            {HOTLINES.map((h, i) => (
              <span key={h.tel}>
                {i > 0 && <span className="font-normal text-muted-foreground"> hoặc </span>}
                <a href={`tel:${h.tel}`} className="whitespace-nowrap tabular-nums hover:underline">
                  {h.label}
                </a>
              </span>
            ))}
          </p>
          <p className="mt-1 text-[13px] text-muted-foreground">(Giờ làm việc: 8:00 – 17:30 T2–T6)</p>
        </div>
      </div>

      <Accordion type="single" collapsible className="border-t min-[900px]:border-t-0">
        {FAQS.map((f, i) => (
          <AccordionItem key={f.q} value={`faq-${i}`}>
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
