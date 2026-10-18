import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form } from "@/components/ui/form";
import { useSaveSessionForm, useSessionBiddingStarted } from "@/hooks/useAuctionSessions";
import { useDossierSaleReady } from "@/hooks/useOrgBiddingContracts";
import {
  defaultSessionForm,
  formToBiddingRules,
  formToSessionInput,
  isOnlineFormat,
  sessionFormSchemaFor,
  sessionToForm,
  type SessionFormValues,
} from "@/lib/auctionSessions/sessionForm";
import type { AuctionSession } from "@/types/auction-session";
import { SessionFormatSection, SessionGeneralSection } from "./SessionBasicsSections";
import { SessionScheduleSection } from "./SessionScheduleSection";
import { SessionDossierSection, SessionRulesSection } from "./SessionDossierRulesSections";
import { SessionFormAside } from "./SessionFormAside";

interface Props {
  /** null = tạo mới. Parent gắn `key` theo id + updated_at để form dựng lại khi server trả bản mới. */
  session: AuctionSession | null;
  stateLabel: string;
  onSaved: (id: string) => void;
  onCancel: () => void;
}

/**
 * Form tạo / sửa phiên (design "Phien Dau Gia - Cong Cong Ty"): các thẻ đánh số bên
 * trái, cột phải dính xem trước + nút Lưu. Lỗi chỉ hiện sau lần bấm Lưu đầu tiên.
 */
export function SessionForm({ session, stateLabel, onSaved, onCancel }: Props) {
  const save = useSaveSessionForm();
  const { data: saleReady } = useDossierSaleReady();
  const { data: biddingStarted } = useSessionBiddingStarted(session?.id);

  const original = useMemo(() => (session ? sessionToForm(session) : defaultSessionForm()), [session]);
  const schema = useMemo(() => sessionFormSchemaFor(session ? original.starts_at : null), [session, original]);
  const form = useForm<SessionFormValues>({ resolver: zodResolver(schema), defaultValues: original });

  const values = form.watch();
  const { errors, isSubmitted } = form.formState;
  const online = isOnlineFormat(values.auction_format);
  const rulesLocked = biddingStarted === true;

  const onSubmit = (v: SessionFormValues) => {
    // Quy tắc chỉ gửi khi có nghĩa + còn đổi được + thật sự đổi (tạo mới thì luôn gửi).
    const rulesChanged =
      !session ||
      v.bidding_method !== original.bidding_method ||
      v.extension_seconds !== original.extension_seconds ||
      v.max_bid_steps !== original.max_bid_steps ||
      v.price_drop_seconds !== original.price_drop_seconds;
    const rules = isOnlineFormat(v.auction_format) && !rulesLocked && rulesChanged ? formToBiddingRules(v) : null;
    save.mutate({ id: session?.id, input: formToSessionInput(v), rules }, { onSuccess: ({ id }) => onSaved(id) });
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        noValidate
        className="grid items-start gap-5 min-[1150px]:grid-cols-[minmax(0,1fr)_320px]"
      >
        <fieldset disabled={save.isPending} className="flex min-w-0 flex-col gap-4">
          <SessionGeneralSection form={form} />
          <SessionFormatSection form={form} />
          <SessionScheduleSection form={form} checkinLocked={!!session?.roster_closed_at} />
          <SessionDossierSection form={form} no={4} saleReady={saleReady} />
          {online && <SessionRulesSection form={form} no={5} locked={rulesLocked} />}
        </fieldset>

        <SessionFormAside
          values={values}
          stateLabel={stateLabel}
          submitLabel={session ? "Lưu thay đổi" : "Tạo phiên"}
          busy={save.isPending}
          errorCount={isSubmitted ? Object.keys(errors).length : 0}
          endInvalid={!!errors.ends_at}
          onCancel={onCancel}
        />
      </form>
    </Form>
  );
}
