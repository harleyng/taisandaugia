import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { RefreshCw, Mail, Phone, User, MessageSquare, Clock } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { vi } from "date-fns/locale";

type ContactStatus = "unread" | "read" | "replied";

interface ContactRow {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  subject: string | null;
  message: string;
  status: ContactStatus;
  created_at: string;
}

const STATUS_LABELS: Record<ContactStatus, string> = {
  unread: "Chưa đọc",
  read: "Đã đọc",
  replied: "Đã phản hồi",
};

const STATUS_COLORS: Record<ContactStatus, string> = {
  unread: "bg-amber-100 text-amber-800",
  read: "bg-blue-100 text-blue-800",
  replied: "bg-green-100 text-green-800",
};

type Tab = "all" | ContactStatus;

const TABS: { key: Tab; label: string }[] = [
  { key: "all", label: "Tất cả" },
  { key: "unread", label: "Chưa đọc" },
  { key: "read", label: "Đã đọc" },
  { key: "replied", label: "Đã phản hồi" },
];

export default function AdminContactsPage() {
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [tab, setTab] = useState<Tab>("all");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ContactRow | null>(null);
  const [processing, setProcessing] = useState(false);

  const fetchContacts = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("contact_submissions")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Không thể tải danh sách liên hệ");
    } else {
      setContacts((data ?? []) as ContactRow[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchContacts(); }, [fetchContacts]);

  const updateStatus = async (id: string, status: ContactStatus) => {
    setProcessing(true);
    const { error } = await supabase
      .from("contact_submissions")
      .update({ status })
      .eq("id", id);

    if (error) {
      toast.error("Cập nhật thất bại");
    } else {
      toast.success(`Đã cập nhật trạng thái: ${STATUS_LABELS[status]}`);
      setContacts((prev) => prev.map((c) => c.id === id ? { ...c, status } : c));
      if (selected?.id === id) setSelected((prev) => prev ? { ...prev, status } : null);
    }
    setProcessing(false);
  };

  const openDetail = async (contact: ContactRow) => {
    setSelected(contact);
    if (contact.status === "unread") {
      await updateStatus(contact.id, "read");
    }
  };

  const filtered = tab === "all" ? contacts : contacts.filter((c) => c.status === tab);
  const countFor = (key: Tab) =>
    key === "all" ? contacts.length : contacts.filter((c) => c.status === key).length;

  return (
    <>
      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">Tin nhắn liên hệ</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Các tin nhắn gửi từ trang Liên hệ</p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchContacts} className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" />
            Làm mới
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-card border border-border rounded-xl p-1 w-fit">
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={[
                "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5",
                tab === key
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              ].join(" ")}
            >
              {label}
              <span className={[
                "text-[10px] rounded-full px-1.5 py-0.5 font-semibold",
                tab === key ? "bg-white/20 text-white" : "bg-muted text-muted-foreground",
              ].join(" ")}>
                {countFor(key)}
              </span>
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {loading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">Đang tải...</div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">Không có tin nhắn nào</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Người gửi</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Chủ đề</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Thời gian</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Trạng thái</th>
                  <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Chi tiết</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((contact, i) => (
                  <tr
                    key={contact.id}
                    className={[
                      i < filtered.length - 1 ? "border-b border-border" : "",
                      contact.status === "unread" ? "bg-amber-50/40" : "",
                    ].join(" ")}
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">{contact.name}</p>
                      <p className="text-[11px] text-muted-foreground">{contact.phone}</p>
                      {contact.email && (
                        <p className="text-[11px] text-muted-foreground">{contact.email}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground max-w-[200px]">
                      <p className="truncate">{contact.subject || <span className="italic opacity-50">Không có chủ đề</span>}</p>
                      <p className="text-[11px] truncate mt-0.5">{contact.message}</p>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {formatDistanceToNow(new Date(contact.created_at), { addSuffix: true, locale: vi })}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[11px] font-semibold px-2 py-1 rounded-full ${STATUS_COLORS[contact.status]}`}>
                        {STATUS_LABELS[contact.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs"
                        onClick={() => openDetail(contact)}
                      >
                        Xem
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Detail dialog */}
      <Dialog open={!!selected} onOpenChange={(o) => { if (!o) setSelected(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Chi tiết tin nhắn</DialogTitle>
            <DialogDescription>
              {selected && format(new Date(selected.created_at), "HH:mm — dd/MM/yyyy", { locale: vi })}
            </DialogDescription>
          </DialogHeader>

          {selected && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-start gap-2">
                  <User className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[11px] text-muted-foreground">Họ tên</p>
                    <p className="text-sm font-medium">{selected.name}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[11px] text-muted-foreground">Điện thoại</p>
                    <p className="text-sm font-medium">{selected.phone}</p>
                  </div>
                </div>
                {selected.email && (
                  <div className="flex items-start gap-2 col-span-2">
                    <Mail className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p className="text-[11px] text-muted-foreground">Email</p>
                      <p className="text-sm font-medium">{selected.email}</p>
                    </div>
                  </div>
                )}
                {selected.subject && (
                  <div className="flex items-start gap-2 col-span-2">
                    <Clock className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p className="text-[11px] text-muted-foreground">Chủ đề</p>
                      <p className="text-sm font-medium">{selected.subject}</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-start gap-2">
                <MessageSquare className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="text-[11px] text-muted-foreground mb-1">Nội dung</p>
                  <p className="text-sm whitespace-pre-wrap bg-muted/50 rounded-lg p-3">{selected.message}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[11px] text-muted-foreground">Trạng thái:</span>
                <span className={`text-[11px] font-semibold px-2 py-1 rounded-full ${STATUS_COLORS[selected.status]}`}>
                  {STATUS_LABELS[selected.status]}
                </span>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setSelected(null)}>Đóng</Button>
            {selected?.status !== "replied" && (
              <Button
                onClick={() => selected && updateStatus(selected.id, "replied")}
                disabled={processing}
                className="bg-green-600 hover:bg-green-700"
              >
                {processing ? "Đang xử lý..." : "Đánh dấu đã phản hồi"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
