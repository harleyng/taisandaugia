// Lưới an toàn cuối cùng cho lỗi render.
//
// Trước đây toàn app KHÔNG có error boundary nào: một lỗi render bất kỳ làm
// React unmount cả cây → màn hình trắng, không log, không cách nào thoát ngoài
// việc user tự F5.
//
// Rủi ro thực tế lớn nhất không phải bug logic mà là ChunkLoadError: PWA đặt
// `registerType: "autoUpdate"` và app có ~90 lazy chunk tên có hash. Khi deploy
// bản mới, tab đang mở của user vẫn giữ index cũ; lần điều hướng tiếp theo nó
// xin một chunk đã bị xoá khỏi server ⇒ import() reject ⇒ màn hình trắng.
// Trường hợp này tự phục hồi được: chỉ cần tải lại trang là lấy được manifest
// mới. Xem `isChunkLoadError` bên dưới.

import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";

/**
 * Trình duyệt không có mã lỗi chuẩn cho việc nạp module thất bại, nên phải
 * khớp theo thông điệp. Bao gồm cả biến thể của Chrome/Safari/Firefox.
 */
export function isChunkLoadError(error: unknown): boolean {
  if (!error) return false;
  const name = error instanceof Error ? error.name : "";
  const msg = error instanceof Error ? error.message : String(error);
  return (
    name === "ChunkLoadError" ||
    /Loading chunk .* failed/i.test(msg) ||
    /Loading CSS chunk/i.test(msg) ||
    /Failed to fetch dynamically imported module/i.test(msg) ||
    /error loading dynamically imported module/i.test(msg) ||
    /Importing a module script failed/i.test(msg)
  );
}

// Chống vòng lặp reload: nếu tải lại rồi vẫn lỗi thì KHÔNG tải lại nữa, hiện
// UI lỗi để user thấy điều gì đó thay vì trang nhấp nháy vô hạn.
const RELOAD_FLAG = "tsd:chunk-reloaded-at";
const RELOAD_COOLDOWN_MS = 20_000;

function tryReloadOnce(): boolean {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_FLAG) ?? 0);
    if (Date.now() - last < RELOAD_COOLDOWN_MS) return false;
    sessionStorage.setItem(RELOAD_FLAG, String(Date.now()));
  } catch {
    // sessionStorage bị chặn (chế độ riêng tư) — vẫn thử reload một lần.
  }
  window.location.reload();
  return true;
}

interface Props {
  children: ReactNode;
  /** Tên khu vực để hiện trong thông báo, vd "Quản trị", "Cổng tổ chức". */
  label?: string;
  /** Khi khu vực này lỗi mà phần còn lại của app vẫn dùng được. */
  compact?: boolean;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (isChunkLoadError(error) && tryReloadOnce()) return;
    // Chưa có dịch vụ giám sát lỗi; console là nơi duy nhất còn lại. Khi nào
    // gắn Sentry thì thay bằng captureException ở đúng chỗ này.
    console.error(
      `[ErrorBoundary${this.props.label ? ` · ${this.props.label}` : ""}]`,
      error,
      info.componentStack,
    );
  }

  private reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const stale = isChunkLoadError(error);
    const title = stale
      ? "Đã có phiên bản mới"
      : this.props.label
        ? `Không tải được phần ${this.props.label}`
        : "Đã xảy ra lỗi";
    const desc = stale
      ? "Trang đang mở là bản cũ. Tải lại để dùng phiên bản mới nhất."
      : "Lỗi này đã được ghi lại. Bạn có thể thử lại hoặc tải lại trang.";

    return (
      <div
        role="alert"
        className={
          this.props.compact
            ? "flex flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-card p-8 text-center"
            : "flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-6 text-center"
        }
      >
        <div className="rounded-full bg-warning/10 p-3">
          <AlertTriangle className="h-6 w-6 text-warning" />
        </div>
        <div className="space-y-1">
          <h1 className="text-lg font-semibold text-foreground">{title}</h1>
          <p className="max-w-md text-sm text-muted-foreground">{desc}</p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button onClick={() => window.location.reload()}>
            <RefreshCw className="mr-1.5 h-4 w-4" />
            Tải lại trang
          </Button>
          {!stale && (
            <Button variant="outline" onClick={this.reset}>
              Thử lại
            </Button>
          )}
        </div>
      </div>
    );
  }
}
