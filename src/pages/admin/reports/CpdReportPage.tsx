import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import FilterCombobox from "@/components/admin/reports/FilterCombobox";
import CpdKpiCards from "@/components/admin/reports/CpdKpiCards";
import CpdByProvinceChart from "@/components/admin/reports/CpdByProvinceChart";
import CpdWorstOrgsChart from "@/components/admin/reports/CpdWorstOrgsChart";
import CpdOrgDetailTable from "@/components/admin/reports/CpdOrgDetailTable";
import { useCpdFilterOptions, useCpdReport } from "@/hooks/useCpdReport";
import { selectableYears } from "@/lib/personnel/cpd";

export default function CpdReportPage() {
  const years = useMemo(() => selectableYears(), []);
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [province, setProvince] = useState<string | null>(null);
  const [provinceLabel, setProvinceLabel] = useState("");
  const [orgId, setOrgId] = useState<string | null>(null);
  const [orgLabel, setOrgLabel] = useState("");
  const [q, setQ] = useState("");

  const { data: options } = useCpdFilterOptions();
  const { report, isLoading, isFetching } = useCpdReport(year, { province, orgId, q });

  const provinceOptions = useMemo(
    () => (options?.provinces ?? []).map((p) => ({ value: p, label: p })),
    [options],
  );
  const orgOptions = useMemo(
    () => (options?.organizations ?? []).map((o) => ({ value: o.id, label: o.name })),
    [options],
  );

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Bồi dưỡng chuyên môn</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Theo dõi nghĩa vụ bồi dưỡng chuyên môn, nghiệp vụ hằng năm của đấu giá viên
          trên toàn sàn — tối thiểu 8 giờ/năm theo Thông tư 19/2024/TT-BTP. Người
          được miễn (Điều 26.3) và người hoàn thành qua hình thức thay thế (Điều 26.2)
          đều tính là tuân thủ.
        </p>
      </div>

      {/* Bộ lọc trên MỘT hàng, ngay phía trên các biểu đồ. */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            {years.map((y) => (
              <SelectItem key={y} value={String(y)}>Năm {y}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <FilterCombobox
          label="Tỉnh/thành"
          value={province}
          valueLabel={provinceLabel}
          options={provinceOptions}
          allLabel="Tất cả tỉnh/thành"
          searchable
          searchPlaceholder="Tìm tỉnh/thành…"
          onChange={(v, l) => { setProvince(v); setProvinceLabel(l); }}
        />

        <FilterCombobox
          label="Tổ chức"
          value={orgId}
          valueLabel={orgLabel}
          options={orgOptions}
          allLabel="Tất cả tổ chức"
          searchable
          searchPlaceholder="Tìm tổ chức…"
          onChange={(v, l) => { setOrgId(v); setOrgLabel(l); }}
        />

        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Tìm tên đấu giá viên…"
          className="w-56"
        />
      </div>

      <CpdKpiCards summary={report.summary} loading={isLoading} />

      <section className="space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Nơi cần can thiệp</h2>
          <p className="text-xs text-muted-foreground">
            Xếp theo mức độ chưa tuân thủ để biết gọi ai trước.
          </p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <CpdByProvinceChart data={report.byProvince} loading={isLoading} />
          <CpdWorstOrgsChart data={report.worstOrgs} loading={isLoading} />
        </div>
      </section>

      <CpdOrgDetailTable
        orgs={report.orgs}
        loading={isLoading}
        truncated={report.truncated}
        cap={report.cap}
      />

      {isFetching && !isLoading && (
        <p className="text-xs text-muted-foreground">Đang cập nhật…</p>
      )}
    </div>
  );
}
