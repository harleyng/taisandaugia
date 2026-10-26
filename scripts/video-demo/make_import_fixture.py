"""Sinh tệp Excel mẫu cho cảnh 4 của video demo (nhập danh mục từ Excel).

20 dòng, trong đó ĐÚNG 2 dòng sai — để màn hình xem trước hiện
"Ghi 18 · 2 dòng chưa ghi" đúng như kịch bản:

  • dòng 6  — thiếu "Tên lô đất"      ⇒ bắt buộc, bị loại
  • dòng 13 — diện tích ghi bằng chữ ⇒ không đọc được, bị loại

Tiêu đề cột lấy ĐÚNG từ src/lib/auctionPlan/itemsImport.ts. Năm kế hoạch là
2026 nên mọi "Thời gian dự kiến" phải nằm trong 2026.

  python3 scripts/video-demo/make_import_fixture.py <đường-dẫn-ra>.xlsx
"""
import sys
from openpyxl import Workbook
from openpyxl.styles import Font, Alignment

HEADERS = ["STT", "Tên lô đất *", "Số lô", "Diện tích (m²)",
           "Đặc điểm, vị trí", "Giá khởi điểm dự kiến (đồng/m²)", "Thời gian dự kiến"]

ROWS = [
    ("Khu dân cư Đồng Chùa — lô LK1", "LK1-01→08", 1240.0, "Giáp tỉnh lộ 295, phường Vũ Ninh", 26500000, "11/2026"),
    ("Khu dân cư Đồng Chùa — lô LK2", "LK2-01→06", 930.5, "Sau trường THCS Vũ Ninh", 25000000, "11/2026"),
    ("Đất ở ven kênh Ngũ Huyện Khê", "NK-01→04", 612.0, "Bờ bắc kênh Ngũ Huyện Khê", 21000000, "Quý IV"),
    ("Khu đấu giá Thị Cầu — đợt mở rộng", "TC-01→10", 1680.0, "Phía nam khu Thị Cầu", 30000000, "12/2026"),
    ("Đất ở xen kẹp tổ 3 Đáp Cầu", "DC-01→02", 288.0, "Ngõ 15 đường Nguyễn Văn Cừ", 23500000, "12/2026"),
    ("", "XX-01", 400.0, "Dòng này thiếu tên lô — sẽ bị loại", 20000000, "11/2026"),          # dòng 6: lỗi
    ("Khu tái định cư Kinh Bắc — phần A", "KB-A-01→07", 1120.0, "Khu tái định cư Kinh Bắc", 28500000, "11/2026"),
    ("Khu tái định cư Kinh Bắc — phần B", "KB-B-01→05", 860.0, "Khu tái định cư Kinh Bắc", 28500000, "12/2026"),
    ("Đất ở đường Hoàng Hoa Thám", "HHT-01→03", 465.0, "Mặt đường Hoàng Hoa Thám", 34000000, "Tháng 11"),
    ("Khu dân cư Võ Cường — lô C", "VC-C-01→09", 1395.0, "Giáp đường Lý Thái Tổ", 27500000, "12/2026"),
    ("Đất ở tổ dân phố Bồ Sơn", "BS-01→04", 528.0, "Tổ dân phố Bồ Sơn, phường Võ Cường", 22500000, "T12"),
    ("Khu đấu giá Hoà Đình — giai đoạn 2", "HD2-01→12", 1980.0, "Phía tây khu Hoà Đình", 24000000, "12/2026"),
    ("Đất ở khu Y Na", "YN-01→03", "khoảng 120", "Khu Y Na, phường Kinh Bắc", 23000000, "11/2026"),  # dòng 13: lỗi
    ("Khu dân cư Niềm Xá — lô D", "NX-D-01→06", 870.0, "Giáp đường Bình Than", 26000000, "11/2026"),
    ("Đất ở ngõ 8 Nguyễn Trãi", "NT8-01→02", 254.0, "Ngõ 8 đường Nguyễn Trãi", 31000000, "12/2026"),
    ("Khu đấu giá Khúc Xuyên", "KX-01→05", 745.0, "Xã Khúc Xuyên cũ, nay phường Vũ Ninh", 19500000, "Quý IV"),
    ("Đất ở khu Thanh Sơn", "TS-01→04", 596.0, "Khu Thanh Sơn, phường Vũ Ninh", 22000000, "12/2026"),
    ("Khu dân cư Vạn An — lô E", "VA-E-01→08", 1210.0, "Giáp đê sông Cầu", 20500000, "11/2026"),
    ("Đất ở tổ 12 Ninh Xá", "NX12-01→03", 402.0, "Tổ 12 phường Ninh Xá", 29500000, "12/2026"),
    ("Khu đấu giá Phong Khê — phần còn lại", "PK-01→07", 1035.0, "Phía bắc khu Phong Khê", 18500000, "12/2026"),
]

def main(out):
    wb = Workbook()
    ws = wb.active
    ws.title = "Danh mục tài sản"
    ws.append(HEADERS)
    for c in ws[1]:
        c.font = Font(bold=True)
        c.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
    for i, r in enumerate(ROWS, start=1):
        ws.append([i, *r])
    for col, w in zip("ABCDEFG", (6, 42, 16, 14, 40, 24, 18)):
        ws.column_dimensions[col].width = w
    ws.freeze_panes = "A2"
    wb.save(out)
    bad = [i for i, r in enumerate(ROWS, start=1) if not r[0] or isinstance(r[2], str)]
    print(f"wrote {out}: {len(ROWS)} dòng, {len(bad)} dòng sai (dòng {', '.join(map(str, bad))})")

if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "mau-nhap-ke-hoach-demo.xlsx")
