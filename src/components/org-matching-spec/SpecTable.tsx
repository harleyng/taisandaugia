import type { SpecTable as SpecTableData } from "./specContent";

/** Bảng của đặc tả — luôn tự cuộn ngang để thân trang không bao giờ cuộn theo. */
export function SpecTable({ table }: { table: SpecTableData }) {
  const numeric = new Set(table.numericCols ?? []);

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[420px] border-collapse text-sm">
        <thead>
          <tr>
            {table.head.map((h, i) => (
              <th
                key={h}
                className={`whitespace-nowrap border-b border-border py-2 pr-4 text-left text-[10px] font-bold uppercase tracking-[0.09em] text-muted-foreground ${
                  numeric.has(i) ? "text-right" : ""
                }`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, ri) => (
            <tr key={ri}>
              {row.map((cell, ci) => {
                const muted = typeof cell !== "string" && cell.muted;
                const text = typeof cell === "string" ? cell : cell.text;
                return (
                  <td
                    key={ci}
                    className={`border-b border-border/60 py-2 pr-4 align-top ${
                      numeric.has(ci)
                        ? "whitespace-nowrap text-right font-mono font-medium tabular-nums text-foreground"
                        : ""
                    } ${muted ? "text-muted-foreground" : "text-foreground"}`}
                  >
                    {text}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
        {table.foot && (
          <tfoot>
            <tr>
              <td
                colSpan={table.head.length - 1}
                className="border-t-2 border-foreground pt-2.5 text-base font-bold text-foreground"
              >
                {table.foot.label}
              </td>
              <td className="border-t-2 border-foreground pt-2.5 text-right font-mono text-base font-bold tabular-nums text-primary">
                {table.foot.value}
              </td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
