import { Fragment } from "react";

/** **đậm** · *nghiêng* · `mã nguồn` — ba kiểu nhấn duy nhất mà đặc tả dùng tới. */
const TOKEN = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;

/**
 * Render lời văn trong specContent.ts.
 *
 * Nội dung là văn bản tĩnh do chính đội sản phẩm viết, nhưng vẫn không dùng
 * dangerouslySetInnerHTML: chuỗi đi qua đây rồi có ngày được dịch/biên tập ở
 * chỗ khác, và một cú pháp nhỏ dễ kiểm soát hơn một lỗ chèn HTML.
 */
export function RichText({ text }: { text: string }) {
  return (
    <>
      {text.split(TOKEN).map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return (
            <strong key={i} className="font-semibold text-foreground">
              {part.slice(2, -2)}
            </strong>
          );
        }
        if (part.startsWith("`") && part.endsWith("`")) {
          return (
            <code key={i} className="rounded bg-primary/10 px-1.5 py-0.5 font-mono text-[0.85em] text-primary">
              {part.slice(1, -1)}
            </code>
          );
        }
        if (part.startsWith("*") && part.endsWith("*")) {
          return <em key={i}>{part.slice(1, -1)}</em>;
        }
        return <Fragment key={i}>{part}</Fragment>;
      })}
    </>
  );
}
