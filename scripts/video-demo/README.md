# Bộ dựng video demo (không cần ffmpeg)

| Tệp | Việc |
|---|---|
| `mkvideo.swift` → `mkvideo` | Ghép khung ảnh + phụ đề tiếng Việt + nhạc → `.mp4` (H.264/AAC) bằng AVFoundation. `swiftc -O -framework AVFoundation -framework AppKit mkvideo.swift -o mkvideo` |
| `make_music.py` | Sinh nhạc nền pad Am–F–C–G. `python3 -I make_music.py bed.wav <giây>` |
| `script-vi.md` | Kịch bản phụ đề — **duyệt lời trước khi quay** |
| `bed.wav` | Nhạc nền hiện tại (96s, đỉnh −18 dBFS) |

Vì sao không dùng ffmpeg: macOS 14 giờ là cấu hình **Tier 3** của Homebrew ⇒ không còn bottle, mọi formula phải biên dịch, và chuỗi phụ thuộc của ffmpeg chết ở `python@3.15` (clang của Sonoma thiếu hỗ trợ tail-call mà CPython 3.15 đòi). AVFoundation + CoreText có sẵn trong máy, dàn chữ tiếng Việt đúng dấu, không tải gì từ ngoài.

Lệnh hữu ích:

    ./mkvideo --selftest ./selftest       # tự dựng ảnh + video mẫu để kiểm
    ./mkvideo manifest.json               # dựng video thật
    ./mkvideo --probe out.mp4             # thay cho ffprobe
    ./mkvideo --frame out.mp4 4.0 f.png   # xuất một khung để soi dấu tiếng Việt

---

## Vì sao `mkvideo.swift` chưa chạy được trên máy này

Bộ Command Line Tools đang hỏng: `module.modulemap` của CLT định nghĩa trùng module `SwiftBridging`, nên mọi lần biên dịch Swift đều chết ở

    /Library/Developer/CommandLineTools/usr/include/swift/module.modulemap:13:8:
    error: redefinition of module 'SwiftBridging'

Máy cũng **không có `Xcode.app`** để chuyển `DEVELOPER_DIR` sang. Muốn dùng tệp này thì phải cài lại Command Line Tools (`sudo rm -rf /Library/Developer/CommandLineTools && xcode-select --install`) hoặc cài Xcode — đều là thay đổi hệ thống cần `sudo`, nên chưa làm.

Mã nguồn **chưa từng được biên dịch lần nào**, vì vậy coi như *chưa kiểm chứng*: chắc chắn còn lỗi biên dịch chưa lộ ra. Giữ lại vì ý tưởng và cấu trúc (manifest JSON → AVAssetWriter, phụ đề vẽ bằng AppKit để đúng dấu tiếng Việt) vẫn dùng lại được.

Hiện tại video được dựng ở hội thoại Chat/Cowork riêng — xem `BRIEF-cowork.md`.
