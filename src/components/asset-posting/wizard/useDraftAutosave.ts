import { useCallback, useEffect, useRef, useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import { useCreatePosting } from "@/hooks/useAssetPosting";
import { buildPostingPayload, type WizardValues } from "../wizardSchema";
import type { DraftSaveState } from "./WizardTopBar";

/** Đủ tối thiểu để lưu một dòng asset_postings (cột NOT NULL): loại + tên ≥ 3 ký tự. */
export const canSaveDraft = (v: WizardValues) => !!v.parentSlug && !!v.childSlug && v.title.trim().length >= 3;

const DEBOUNCE_MS = 2500;

/**
 * Tự lưu nháp ngầm sau mỗi thay đổi (thiết kế v3: "Đã lưu nháp HH:mm" trên thanh trên).
 *
 * MỘT hàng đợi cho mọi lần ghi nháp: lần đầu INSERT, các lần sau UPDATE theo id vừa
 * nhận. Lưu thủ công (Lưu & thoát, Thêm 3D, Hoàn tất) phải `settle()` trước — nếu
 * không, một INSERT ngầm đang bay cộng với một INSERT thủ công sẽ ra hai hồ sơ trùng.
 */
export function useDraftAutosave(
  form: UseFormReturn<WizardValues>,
  savedId: string | null,
  onSaved: (id: string) => void,
) {
  const create = useCreatePosting();
  // Hàm hẹn giờ gọi bản mới nhất — useMutation trả object mới mỗi lần render.
  const mutateRef = useRef(create.mutateAsync);
  mutateRef.current = create.mutateAsync;
  const onSavedRef = useRef(onSaved);
  onSavedRef.current = onSaved;
  const [state, setState] = useState<DraftSaveState>({ kind: "idle" });
  const idRef = useRef(savedId);
  const timer = useRef<number | null>(null);
  const inFlight = useRef<Promise<void> | null>(null);
  const again = useRef(false);
  const enabled = useRef(true);

  // savedId còn đổi từ ngoài (lưu thủ công, "Số hoá tài sản khác" xoá về null).
  useEffect(() => {
    idRef.current = savedId;
  }, [savedId]);

  const clearTimer = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(() => clearTimer, []);

  const run = useCallback(() => {
    const v = form.getValues();
    if (!enabled.current || !canSaveDraft(v)) return;
    if (inFlight.current) {
      again.current = true;
      return;
    }
    setState({ kind: "saving" });
    inFlight.current = mutateRef
      .current({ posting: buildPostingPayload(v), status: "draft", postingId: idRef.current ?? undefined, silent: true })
      .then(({ postingId }) => {
        idRef.current = postingId;
        onSavedRef.current(postingId);
        setState({ kind: "saved", at: new Date() });
      })
      .catch(() => setState({ kind: "error" }))
      .finally(() => {
        inFlight.current = null;
        if (again.current) {
          again.current = false;
          run();
        }
      });
  }, [form]);

  /** Gọi sau mỗi thay đổi form — dồn lại, lưu khi người dùng ngừng gõ. */
  const schedule = useCallback(() => {
    if (!enabled.current) return;
    clearTimer();
    timer.current = window.setTimeout(run, DEBOUNCE_MS);
  }, [run]);

  /** Huỷ lượt đang hẹn và chờ lượt đang bay xong. Trả id hồ sơ hiện có (null = chưa lưu). */
  const settle = useCallback(async (): Promise<string | null> => {
    clearTimer();
    again.current = false;
    if (inFlight.current) await inFlight.current;
    return idRef.current;
  }, []);

  /** Lưu thủ công vừa thành công — đồng bộ id + giờ lưu. */
  const markSaved = useCallback((id: string) => {
    idRef.current = id;
    setState({ kind: "saved", at: new Date() });
  }, []);

  /** Tắt / bật tự lưu (tắt khi đang hoàn tất hoặc đã xong). */
  const setEnabled = useCallback((on: boolean) => {
    enabled.current = on;
    if (!on) clearTimer();
  }, []);

  const reset = useCallback(() => {
    clearTimer();
    idRef.current = null;
    setState({ kind: "idle" });
  }, []);

  return { state, schedule, settle, markSaved, setEnabled, reset };
}
