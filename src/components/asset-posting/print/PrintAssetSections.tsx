import {
  declarationRows,
  formatFileSize,
  legalDeclared,
  postingDocs,
  printDayTime,
  specRows,
} from "@/lib/asset-posting/postingPrint";
import type { PostingPrintData } from "@/hooks/usePostingPrintData";
import { PrintEmpty, SectionHead } from "./printParts";

const MARK = { ok: "✓", err: "✕", mu: "—", me: "!" } as const;

/** 01 Mô tả & thông số. */
export function PrintSpecsSection({ data }: { data: PostingPrintData }) {
  const p = data.posting;
  const specs = specRows(p);
  const desc = p.description?.trim();
  return (
    <section className="sec">
      <SectionHead n="01" title="Mô tả & thông số" />
      {desc && <p className="desc">{desc}</p>}
      {specs.length > 0 ? (
        <div className="specs">
          {specs.map((s) => (
            <div key={s.k}>
              <small className="one">{s.k}</small>
              <b className="one">{s.v}</b>
            </div>
          ))}
        </div>
      ) : (
        <PrintEmpty
          icon="≡"
          title="Chưa có thông số kỹ thuật"
          text="Chủ tài sản chưa khai thông số. Mục này cập nhật khi hồ sơ hoàn thiện."
        />
      )}
    </section>
  );
}

/** 02 Pháp lý & hiện trạng: 4 ô tự khai, cam kết điện tử, giấy tờ đính kèm. */
export function PrintLegalStatusSection({ data }: { data: PostingPrintData }) {
  const p = data.posting;
  const docs = postingDocs(p);
  const decl = p.ownership_declaration;
  const flagged = data.status.stage === "rejected";

  return (
    <section className="sec">
      <SectionHead n="02" title="Pháp lý & hiện trạng" aux="Chủ tài sản tự khai" />
      {!legalDeclared(p) ? (
        <PrintEmpty
          icon="!"
          title="Chưa khai pháp lý"
          text="Bản cam kết sở hữu và giấy tờ đính kèm chưa được cung cấp."
        />
      ) : (
        <>
          <div className="decl">
            {declarationRows(p).map((r) => (
              <div key={r.k}>
                <i className={r.tone === "ok" ? undefined : r.tone}>{MARK[r.tone]}</i>
                <span>
                  <small className="one">{r.k}</small>
                  <b className="one">{r.v}</b>
                </span>
              </div>
            ))}
          </div>
          {decl && (
            <div className="sig">
              <i>✓</i>
              <b>Đã ký cam kết sở hữu điện tử</b>
              <span>
                {decl.name} · {printDayTime(decl.accepted_at)} · bản {decl.version}
              </span>
            </div>
          )}
          <div className="docs">
            <p className="sub">Giấy tờ đính kèm · {docs.length}</p>
            {docs.length > 0 ? (
              <div className="files">
                {docs.map((d) => {
                  const size = formatFileSize(data.docSizes[d.path]);
                  return (
                    <div key={d.path} className="file">
                      <span className="fi">{d.ext}</span>
                      <div>
                        <div className="fn one">{d.name}</div>
                        <div className="fs one" style={flagged ? { color: "var(--err)" } : undefined}>
                          {[d.kind, size].filter(Boolean).join(" · ")}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <PrintEmpty
                icon="+"
                title="Chưa đính kèm giấy tờ"
                text="Cần tối thiểu giấy tờ chứng minh quyền sở hữu."
              />
            )}
          </div>
        </>
      )}
    </section>
  );
}
