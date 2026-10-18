import { useState } from "react";
import { Banknote, Landmark, ShieldCheck } from "lucide-react";
import { KvBox, Note } from "@/components/auction-sessions/detail/ui";
import { PrintQr } from "@/components/asset-posting/print/PrintQr";
import { formatVnd } from "@/lib/advertising/slug";
import { formatDateTime } from "@/lib/auctionSessions/datetime";
import { bankBinOf, groupAccountNumber, transferMemo, vietQrPayload } from "@/lib/biddingContracts/depositTransfer";
import type { ContractDepositInfo } from "@/hooks/useBuyerContracts";
import type { MyContract } from "@/hooks/useBuyerContracts";
import { PillTabs } from "../BuyerPageShell";
import { CheckList, CopyRow } from "../ui";

type Method = "bank" | "cash" | "bg";

/** "Cách nộp": chuyển khoản (VietQR + thông tin sao chép), tiền mặt, thư bảo lãnh. */
export function DepositMethodCard({ contract: c, info }: { contract: MyContract; info: ContractDepositInfo }) {
  const [method, setMethod] = useState<Method>("bank");
  const amount = info.deposit_due;
  const deadline = formatDateTime(info.deadline);
  const sessionCode = c.auction_sessions?.code ?? "";
  const orgName = info.org.name ?? "tổ chức đấu giá";

  return (
    <section className="flex flex-col gap-3 rounded-2xl bg-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold text-foreground">Cách nộp</h2>
        <PillTabs<Method>
          onWhite
          value={method}
          onChange={setMethod}
          items={[
            { key: "bank", label: "Chuyển khoản", icon: <Landmark className="h-4 w-4" /> },
            { key: "cash", label: "Tiền mặt", icon: <Banknote className="h-4 w-4" /> },
            { key: "bg", label: "Thư bảo lãnh", icon: <ShieldCheck className="h-4 w-4" /> },
          ]}
        />
      </div>
      {method === "bank" && <BankTransfer contract={c} info={info} />}
      {method === "cash" && (
        <>
          <KvBox
            rows={[
              { label: "Nơi nộp", value: info.org.address ?? "Văn phòng tổ chức đấu giá" },
              { label: "Giờ nhận", value: info.org.phone ? `Giờ hành chính · gọi trước ${info.org.phone}` : "Giờ hành chính" },
              { label: "Số tiền", value: <b>{formatVnd(amount)}</b> },
              { label: "Hạn nộp", value: deadline },
            ]}
          />
          <CheckList
            items={[
              { children: <>Mang <b>giấy tờ tuỳ thân bản gốc</b> của người đăng ký và đọc mã hồ sơ <b className="font-mono">{c.code}</b> cho thủ quỹ.</> },
              { children: <>Nhận <b>phiếu thu có đóng dấu</b> và giữ lại để đối chiếu khi hoàn tiền.</> },
              { children: "Người nộp hộ cần giấy uỷ quyền và giấy tờ tuỳ thân của mình." },
            ]}
          />
        </>
      )}
      {method === "bg" && (
        <>
          <KvBox
            rows={[
              { label: "Bên nhận bảo lãnh", value: orgName },
              { label: "Giá trị bảo lãnh", value: <b>Tối thiểu {formatVnd(amount)}</b> },
              { label: "Hiệu lực", value: "Ít nhất 30 ngày sau ngày đấu giá" },
              { label: "Hạn nộp bản gốc", value: deadline },
            ]}
          />
          <CheckList
            items={[
              {
                children: (
                  <>
                    Do ngân hàng được phép hoạt động tại Việt Nam phát hành, ghi rõ mã hồ sơ <b className="font-mono">{c.code}</b>
                    {sessionCode && (
                      <>
                        {" "}
                        và phiên <b className="font-mono">{sessionCode}</b>
                      </>
                    )}
                    .
                  </>
                ),
              },
              { children: <>Nộp <b>bản gốc</b> tại văn phòng tổ chức; bản scan chỉ để đối chiếu trước.</> },
            ]}
          />
          <Note>Chỉ dùng thư bảo lãnh khi Quy chế cuộc đấu giá của phiên cho phép thay tiền đặt trước.</Note>
        </>
      )}
    </section>
  );
}

function BankTransfer({ contract: c, info }: { contract: MyContract; info: ContractDepositInfo }) {
  const bank = info.bank;
  if (!bank) {
    return (
      <Note tone="amber">
        Tổ chức chưa cập nhật tài khoản nhận tiền đặt trước trên sàn.
        {info.org.phone ? ` Liên hệ ${info.org.phone} để nhận thông tin chuyển khoản.` : " Liên hệ tổ chức để nhận thông tin chuyển khoản."}
      </Note>
    );
  }
  const memo = transferMemo(c.code, c.buyer_kind === "organization" ? (c.org_name ?? c.full_name) : c.full_name);
  const bin = bankBinOf(bank.bank_name);
  const qr = bin ? vietQrPayload({ bin, accountNumber: bank.account_number, amount: info.deposit_due, memo }) : null;
  const self = c.buyer_kind === "organization" ? "tổ chức đăng ký" : "chính người đăng ký";

  return (
    <>
      <div className="grid items-start gap-6 sm:grid-cols-[200px_minmax(0,1fr)]">
        <div className="flex flex-col items-center gap-2">
          <div className="flex aspect-square w-[200px] items-center justify-center rounded-xl bg-muted p-3">
            {qr ? (
              <div className="h-full w-full rounded-lg bg-card p-2">
                <PrintQr value={qr} label={`Mã VietQR chuyển ${formatVnd(info.deposit_due)}`} />
              </div>
            ) : (
              <span className="px-4 text-center text-xs text-muted-foreground">
                Chưa tạo được mã VietQR cho ngân hàng này — chuyển theo thông tin bên cạnh.
              </span>
            )}
          </div>
          {qr && <span className="text-xs text-muted-foreground">Quét bằng app ngân hàng</span>}
        </div>
        <div>
          <CopyRow label="Ngân hàng" value={bank.branch ? `${bank.bank_name} — ${bank.branch}` : bank.bank_name} />
          <CopyRow label="Số tài khoản" value={groupAccountNumber(bank.account_number)} copy={bank.account_number.replace(/\s/g, "")} />
          <CopyRow label="Chủ tài khoản" value={bank.account_holder} />
          <CopyRow label="Số tiền" value={formatVnd(info.deposit_due)} copy={String(info.deposit_due)} big />
          <CopyRow label="Nội dung chuyển khoản" value={memo} copy={memo} big />
        </div>
      </div>
      <Note tone="amber">
        <b>Ghi đúng nội dung chuyển khoản</b> để tổ chức khớp tiền với hồ sơ. Chuyển từ tài khoản đứng tên {self} — tiền từ
        tài khoản người khác có thể bị từ chối.
      </Note>
      <p className="text-xs text-muted-foreground">
        Tiền phải <b className="text-foreground">về tài khoản tổ chức</b> trước {formatDateTime(info.deadline)}. Chuyển liên
        ngân hàng ngoài giờ có thể chậm 1 ngày làm việc.
      </p>
    </>
  );
}
