// mkvideo — ghép khung ảnh + phụ đề tiếng Việt + nhạc nền thành .mp4
//
// Chỉ dùng framework có sẵn của macOS (AVFoundation / CoreGraphics / AppKit),
// không tải gì từ ngoài, không cần ffmpeg. Chữ vẽ bằng bộ dàn chữ của hệ thống
// nên dấu tiếng Việt (ổ, ữ, ậ, ỵ…) hiển thị đúng.
//
//   swiftc -O -framework AVFoundation -framework AppKit mkvideo.swift -o mkvideo
//   ./mkvideo manifest.json
//   ./mkvideo --probe out.mp4        # đọc lại thông số tệp đã xuất
//   ./mkvideo --selftest /tmp/dir    # tự dựng ảnh + video mẫu để kiểm
//
// Manifest:
// {
//   "output": "demo.mp4",
//   "size": {"width": 1920, "height": 1080},
//   "fps": 30,
//   "audio": "bed.wav",
//   "scenes": [
//     {"title": "Kế hoạch đấu giá", "sub": "Xã · Phường · Tỉnh", "duration": 3.5},
//     {"image": "01.png", "duration": 6, "caption": "Cán bộ xã mở danh mục tài sản",
//      "zoomFrom": 1.0, "zoomTo": 1.05, "fadeIn": 0.4, "fadeOut": 0.4}
//   ]
// }

import AVFoundation
import AppKit
import CoreGraphics
import Foundation

// MARK: - Manifest

struct Manifest: Decodable {
    struct Size: Decodable { var width: Int; var height: Int }
    struct Scene: Decodable {
        var image: String?
        var duration: Double
        var caption: String?
        var sub: String?
        var title: String?
        var zoomFrom: Double?
        var zoomTo: Double?
        var fadeIn: Double?
        var fadeOut: Double?
    }
    var output: String
    var size: Size?
    var fps: Int?
    var audio: String?
    var scenes: [Scene]
}

// MARK: - Bảng màu (khớp token của sản phẩm: primary 152 60% 26%)

enum Palette {
    static let background = CGColor(red: 0.047, green: 0.075, blue: 0.067, alpha: 1)
    static let primary    = CGColor(red: 0.067, green: 0.267, blue: 0.180, alpha: 1)
    static let captionBG  = CGColor(red: 0.02, green: 0.03, blue: 0.027, alpha: 0.82)
    static let text       = NSColor.white
    static let subtext    = NSColor(white: 1, alpha: 0.72)
}

// MARK: - Vẽ một khung

final class FrameRenderer {
    let width: Int
    let height: Int
    private var cache: [String: CGImage] = [:]

    init(width: Int, height: Int) {
        self.width = width
        self.height = height
    }

    func image(at path: String) throws -> CGImage {
        if let hit = cache[path] { return hit }
        guard let src = CGImageSourceCreateWithURL(URL(fileURLWithPath: path) as CFURL, nil),
              let img = CGImageSourceCreateImageAtIndex(src, 0, nil) else {
            throw Err("không đọc được ảnh: \(path)")
        }
        cache[path] = img
        return img
    }

    /// Vẽ scene vào pixel buffer. `progress` là 0…1 trong scene (để zoom chậm).
    func draw(scene: Manifest.Scene, progress: Double, into pb: CVPixelBuffer) throws {
        CVPixelBufferLockBaseAddress(pb, [])
        defer { CVPixelBufferUnlockBaseAddress(pb, []) }

        guard let base = CVPixelBufferGetBaseAddress(pb) else { throw Err("pixel buffer rỗng") }
        let space = CGColorSpaceCreateDeviceRGB()
        guard let ctx = CGContext(
            data: base,
            width: width,
            height: height,
            bitsPerComponent: 8,
            bytesPerRow: CVPixelBufferGetBytesPerRow(pb),
            space: space,
            bitmapInfo: CGImageAlphaInfo.premultipliedFirst.rawValue
                | CGBitmapInfo.byteOrder32Little.rawValue
        ) else { throw Err("không tạo được CGContext") }

        let canvas = CGRect(x: 0, y: 0, width: CGFloat(width), height: CGFloat(height))

        // nền
        ctx.setFillColor(Palette.background)
        ctx.fill(canvas)

        if let path = scene.image {
            // aspect-fill + zoom chậm (Ken Burns)
            let img = try image(at: path)
            let from = scene.zoomFrom ?? 1.0
            let to = scene.zoomTo ?? 1.0
            let zoom = from + (to - from) * progress
            let iw = CGFloat(img.width), ih = CGFloat(img.height)
            let fill = max(canvas.width / iw, canvas.height / ih) * CGFloat(zoom)
            let w = iw * fill, h = ih * fill
            ctx.draw(img, in: CGRect(x: (canvas.width - w) / 2,
                                     y: (canvas.height - h) / 2,
                                     width: w, height: h))
        } else {
            // thẻ chữ: dải màu primary ở dưới cho đỡ phẳng
            ctx.setFillColor(Palette.primary)
            ctx.fill(CGRect(x: 0, y: 0, width: canvas.width, height: canvas.height * 0.34))
        }

        // chữ
        pushContext(ctx) {
            if let title = scene.title {
                drawCard(title: title, sub: scene.sub, in: canvas)
            }
            if let caption = scene.caption {
                drawCaption(caption, sub: scene.title == nil ? scene.sub : nil, in: canvas)
            }
        }

        // fade đen đầu/cuối scene
        let fadeIn = scene.fadeIn ?? 0
        let fadeOut = scene.fadeOut ?? 0
        let t = progress * scene.duration
        var dark = 0.0
        if fadeIn > 0, t < fadeIn { dark = 1 - t / fadeIn }
        if fadeOut > 0, t > scene.duration - fadeOut {
            dark = max(dark, 1 - (scene.duration - t) / fadeOut)
        }
        if dark > 0.001 {
            ctx.setFillColor(CGColor(red: 0, green: 0, blue: 0, alpha: CGFloat(min(1, dark))))
            ctx.fill(canvas)
        }
    }

    private func pushContext(_ ctx: CGContext, _ body: () -> Void) {
        NSGraphicsContext.saveGraphicsState()
        NSGraphicsContext.current = NSGraphicsContext(cgContext: ctx, flipped: false)
        body()
        NSGraphicsContext.restoreGraphicsState()
    }

    private func attrs(size: CGFloat, weight: NSFont.Weight, color: NSColor,
                       align: NSTextAlignment) -> [NSAttributedString.Key: Any] {
        let p = NSMutableParagraphStyle()
        p.alignment = align
        p.lineSpacing = size * 0.22
        // Phông hệ thống phủ đầy đủ dấu tiếng Việt.
        return [.font: NSFont.systemFont(ofSize: size, weight: weight),
                .foregroundColor: color,
                .paragraphStyle: p]
    }

    private func drawCard(title: String, sub: String?, in canvas: CGRect) {
        let s = canvas.height / 1080
        let box = canvas.insetBy(dx: canvas.width * 0.1, dy: 0)
        let titleAttr = NSAttributedString(string: title,
            attributes: attrs(size: 86 * s, weight: .semibold, color: Palette.text, align: .center))
        let titleSize = titleAttr.boundingRect(with: CGSize(width: box.width, height: .greatestFiniteMagnitude),
                                               options: [.usesLineFragmentOrigin])
        var y = canvas.midY - titleSize.height / 2
        if let sub { _ = sub; y += 40 * s }
        titleAttr.draw(with: CGRect(x: box.minX, y: y, width: box.width, height: titleSize.height),
                       options: [.usesLineFragmentOrigin])
        if let sub {
            let subAttr = NSAttributedString(string: sub,
                attributes: attrs(size: 40 * s, weight: .regular, color: Palette.subtext, align: .center))
            let subSize = subAttr.boundingRect(with: CGSize(width: box.width, height: .greatestFiniteMagnitude),
                                               options: [.usesLineFragmentOrigin])
            subAttr.draw(with: CGRect(x: box.minX, y: y - subSize.height - 26 * s,
                                      width: box.width, height: subSize.height),
                         options: [.usesLineFragmentOrigin])
        }
    }

    private func drawCaption(_ text: String, sub: String?, in canvas: CGRect) {
        let s = canvas.height / 1080
        let maxW = canvas.width * 0.82
        let main = NSAttributedString(string: text,
            attributes: attrs(size: 44 * s, weight: .medium, color: Palette.text, align: .center))
        let mainSize = main.boundingRect(with: CGSize(width: maxW, height: .greatestFiniteMagnitude),
                                         options: [.usesLineFragmentOrigin])
        var subSize = CGRect.zero
        var subAttr: NSAttributedString?
        if let sub {
            let a = NSAttributedString(string: sub,
                attributes: attrs(size: 30 * s, weight: .regular, color: Palette.subtext, align: .center))
            subAttr = a
            subSize = a.boundingRect(with: CGSize(width: maxW, height: .greatestFiniteMagnitude),
                                     options: [.usesLineFragmentOrigin])
        }

        let padX = 44 * s, padY = 28 * s, gap = subAttr == nil ? 0 : 12 * s
        let barH = mainSize.height + subSize.height + gap + padY * 2
        let barW = min(maxW + padX * 2, max(mainSize.width, subSize.width) + padX * 2)
        let bar = CGRect(x: canvas.midX - barW / 2, y: 84 * s, width: barW, height: barH)

        // nền phụ đề bo góc (rounded-2xl ≈ 16px ở 1x)
        if let ctx = NSGraphicsContext.current?.cgContext {
            let r = 22 * s
            ctx.setFillColor(Palette.captionBG)
            ctx.beginPath()
            ctx.addPath(CGPath(roundedRect: bar, cornerWidth: r, cornerHeight: r, transform: nil))
            ctx.fillPath()
        }

        var y = bar.minY + padY
        if let subAttr {
            subAttr.draw(with: CGRect(x: bar.minX + padX, y: y, width: bar.width - padX * 2,
                                      height: subSize.height),
                         options: [.usesLineFragmentOrigin])
            y += subSize.height + gap
        }
        main.draw(with: CGRect(x: bar.minX + padX, y: y, width: bar.width - padX * 2,
                               height: mainSize.height),
                  options: [.usesLineFragmentOrigin])
    }
}

// MARK: - Mã hoá

struct Err: LocalizedError {
    let msg: String
    init(_ m: String) { msg = m }
    var errorDescription: String? { msg }
}

func spinUntilReady(_ input: AVAssetWriterInput) {
    while !input.isReadyForMoreMediaData {
        usleep(4000)
    }
}

func encode(_ m: Manifest) throws {
    let width = m.size?.width ?? 1920
    let height = m.size?.height ?? 1080
    let fps = m.fps ?? 30
    guard !m.scenes.isEmpty else { throw Err("manifest không có scene nào") }
    guard width % 2 == 0, height % 2 == 0 else { throw Err("kích thước phải chia hết cho 2 (H.264)") }

    let out = URL(fileURLWithPath: m.output)
    try? FileManager.default.removeItem(at: out)

    let writer = try AVAssetWriter(outputURL: out, fileType: .mp4)

    let vSettings: [String: Any] = [
        AVVideoCodecKey: AVVideoCodecType.h264,
        AVVideoWidthKey: width,
        AVVideoHeightKey: height,
        AVVideoCompressionPropertiesKey: [
            AVVideoAverageBitRateKey: max(2_000_000, width * height * 4),
            AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel,
            AVVideoMaxKeyFrameIntervalKey: fps * 2,
        ],
    ]
    let vInput = AVAssetWriterInput(mediaType: .video, outputSettings: vSettings)
    vInput.expectsMediaDataInRealTime = false
    let adaptor = AVAssetWriterInputPixelBufferAdaptor(
        assetWriterInput: vInput,
        sourcePixelBufferAttributes: [
            kCVPixelBufferPixelFormatTypeKey as String: Int(kCVPixelFormatType_32BGRA),
            kCVPixelBufferWidthKey as String: width,
            kCVPixelBufferHeightKey as String: height,
            kCVPixelBufferCGBitmapContextCompatibilityKey as String: true,
        ])
    guard writer.canAdd(vInput) else { throw Err("không thêm được luồng video") }
    writer.add(vInput)

    // nhạc nền (tuỳ chọn)
    var aInput: AVAssetWriterInput?
    var aOutput: AVAssetReaderTrackOutput?
    var reader: AVAssetReader?
    if let audioPath = m.audio {
        let asset = AVURLAsset(url: URL(fileURLWithPath: audioPath))
        guard let track = asset.tracks(withMediaType: .audio).first else {
            throw Err("tệp nhạc không có luồng âm thanh: \(audioPath)")
        }
        let r = try AVAssetReader(asset: asset)
        let o = AVAssetReaderTrackOutput(track: track, outputSettings: [
            AVFormatIDKey: Int(kAudioFormatLinearPCM),
            AVLinearPCMIsFloatKey: false,
            AVLinearPCMBitDepthKey: 16,
            AVLinearPCMIsBigEndianKey: false,
            AVLinearPCMIsNonInterleaved: false,
        ])
        r.add(o)
        let i = AVAssetWriterInput(mediaType: .audio, outputSettings: [
            AVFormatIDKey: Int(kAudioFormatMPEG4AAC),
            AVSampleRateKey: 44100,
            AVNumberOfChannelsKey: 2,
            AVEncoderBitRateKey: 128_000,
        ])
        i.expectsMediaDataInRealTime = false
        guard writer.canAdd(i) else { throw Err("không thêm được luồng âm thanh") }
        writer.add(i)
        aInput = i; aOutput = o; reader = r
    }

    guard writer.startWriting() else {
        throw Err("startWriting thất bại: \(writer.error?.localizedDescription ?? "?")")
    }
    writer.startSession(atSourceTime: .zero)

    // ---- video ----
    let renderer = FrameRenderer(width: width, height: height)
    var frameIndex = 0
    var totalFrames = 0
    for scene in m.scenes { totalFrames += max(1, Int((scene.duration * Double(fps)).rounded())) }

    for (si, scene) in m.scenes.enumerated() {
        let n = max(1, Int((scene.duration * Double(fps)).rounded()))
        for f in 0..<n {
            spinUntilReady(vInput)
            guard let pool = adaptor.pixelBufferPool else { throw Err("không có pixel buffer pool") }
            var pbOut: CVPixelBuffer?
            guard CVPixelBufferPoolCreatePixelBuffer(nil, pool, &pbOut) == kCVReturnSuccess,
                  let pb = pbOut else { throw Err("không cấp được pixel buffer") }
            let progress = n <= 1 ? 0 : Double(f) / Double(n - 1)
            try renderer.draw(scene: scene, progress: progress, into: pb)
            let pts = CMTime(value: CMTimeValue(frameIndex), timescale: CMTimeScale(fps))
            if !adaptor.append(pb, withPresentationTime: pts) {
                throw Err("append khung \(frameIndex) thất bại: \(writer.error?.localizedDescription ?? "?")")
            }
            frameIndex += 1
        }
        FileHandle.standardError.write(
            "  scene \(si + 1)/\(m.scenes.count) · \(n) khung\n".data(using: .utf8)!)
    }
    vInput.markAsFinished()
    let videoDuration = CMTime(value: CMTimeValue(frameIndex), timescale: CMTimeScale(fps))

    // ---- âm thanh: cắt đúng độ dài video ----
    if let aInput, let aOutput, let reader {
        guard reader.startReading() else {
            throw Err("đọc nhạc thất bại: \(reader.error?.localizedDescription ?? "?")")
        }
        var appended = 0
        while let sample = aOutput.copyNextSampleBuffer() {
            let pts = CMSampleBufferGetPresentationTimeStamp(sample)
            if CMTimeCompare(pts, videoDuration) >= 0 { break }
            spinUntilReady(aInput)
            if !aInput.append(sample) { break }
            appended += 1
        }
        reader.cancelReading()
        aInput.markAsFinished()
        FileHandle.standardError.write("  nhạc: \(appended) gói\n".data(using: .utf8)!)
    }

    let done = DispatchSemaphore(value: 0)
    writer.finishWriting { done.signal() }
    done.wait()
    if writer.status != .completed {
        throw Err("kết xuất thất bại: \(writer.error?.localizedDescription ?? "?")")
    }
    let secs = Double(frameIndex) / Double(fps)
    print("✓ \(m.output) · \(frameIndex) khung · \(String(format: "%.1f", secs))s · \(width)×\(height) @\(fps)fps")
}

// MARK: - Probe (thay cho ffprobe)

/// 'avc1' / 'mp4a' … từ mã FourCC.
func fourCC(_ code: FourCharCode) -> String {
    var out = ""
    for shift in [24, 16, 8, 0] {
        let byte = UInt8((code >> UInt32(shift)) & 0xFF)
        out.append(Character(UnicodeScalar(byte)))
    }
    return out
}

func probe(_ path: String) throws {
    let asset = AVURLAsset(url: URL(fileURLWithPath: path))
    let dur = CMTimeGetSeconds(asset.duration)
    print("tệp: \(path)")
    print("thời lượng: \(String(format: "%.2f", dur))s")
    var bytes = 0
    if let attrs = try? FileManager.default.attributesOfItem(atPath: path),
       let n = attrs[.size] as? Int {
        bytes = n
    }
    let mb = Double(bytes) / 1_048_576
    print("dung lượng: \(String(format: "%.1f", mb)) MB")
    for t in asset.tracks {
        var line = "luồng \(t.mediaType.rawValue): \(String(format: "%.2f", CMTimeGetSeconds(t.timeRange.duration)))s"
        if t.mediaType == .video {
            line += " · \(Int(t.naturalSize.width))×\(Int(t.naturalSize.height)) · \(String(format: "%.0f", t.nominalFrameRate))fps"
        }
        if let fd = t.formatDescriptions.first as? CMFormatDescription {
            line += " · " + fourCC(CMFormatDescriptionGetMediaSubType(fd))
        }
        print(line)
    }
}

/// Xuất một khung ra PNG để soi mắt thường (kiểm dấu tiếng Việt).
func extractFrame(_ path: String, at seconds: Double, to outPath: String) throws {
    let asset = AVURLAsset(url: URL(fileURLWithPath: path))
    let gen = AVAssetImageGenerator(asset: asset)
    gen.appliesPreferredTrackTransform = true
    gen.requestedTimeToleranceBefore = .zero
    gen.requestedTimeToleranceAfter = .zero
    let img = try gen.copyCGImage(at: CMTime(seconds: seconds, preferredTimescale: 600), actualTime: nil)
    let rep = NSBitmapImageRep(cgImage: img)
    guard let data = rep.representation(using: .png, properties: [:]) else {
        throw Err("không mã hoá được PNG")
    }
    try data.write(to: URL(fileURLWithPath: outPath))
    print("✓ \(outPath) (\(img.width)×\(img.height))")
}

// MARK: - Selftest

func selftest(dir: String) throws {
    let fm = FileManager.default
    try? fm.createDirectory(atPath: dir, withIntermediateDirectories: true)

    // dựng 2 ảnh giả kiểu ảnh chụp màn hình
    for (idx, tint) in [(1, NSColor(calibratedRed: 0.09, green: 0.16, blue: 0.13, alpha: 1)),
                        (2, NSColor(calibratedRed: 0.13, green: 0.11, blue: 0.17, alpha: 1))] {
        let w = 1512, h = 982
        let rep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: w, pixelsHigh: h,
                                   bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true,
                                   isPlanar: false, colorSpaceName: .calibratedRGB,
                                   bytesPerRow: 0, bitsPerPixel: 0)!
        NSGraphicsContext.saveGraphicsState()
        NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
        tint.setFill()
        NSRect(x: 0, y: 0, width: w, height: h).fill()
        NSColor(white: 1, alpha: 0.10).setFill()
        for r in 0..<9 {
            NSRect(x: 60, y: 80 + r * 92, width: w - 120, height: 64).fill()
        }
        let p = NSMutableParagraphStyle(); p.alignment = .left
        NSAttributedString(string: "Ảnh mẫu \(idx) — Kế hoạch đấu giá QSDĐ",
            attributes: [.font: NSFont.systemFont(ofSize: 44, weight: .semibold),
                         .foregroundColor: NSColor.white,
                         .paragraphStyle: p]).draw(at: NSPoint(x: 60, y: h - 110))
        NSGraphicsContext.restoreGraphicsState()
        try rep.representation(using: .png, properties: [:])!
            .write(to: URL(fileURLWithPath: "\(dir)/shot0\(idx).png"))
    }

    let manifest = Manifest(
        output: "\(dir)/selftest.mp4",
        size: .init(width: 1280, height: 720),
        fps: 30,
        audio: "\(dir)/../bed.wav",
        scenes: [
            .init(image: nil, duration: 2.5, caption: nil, sub: "Xã · Phường · Tỉnh đồng bộ",
                  title: "Kế hoạch đấu giá", zoomFrom: nil, zoomTo: nil, fadeIn: 0.5, fadeOut: 0.3),
            .init(image: "\(dir)/shot01.png", duration: 3, caption: "Cán bộ xã lập danh mục tài sản đấu giá",
                  sub: "19 thửa · 63,2 tỷ đồng dự kiến", title: nil,
                  zoomFrom: 1.0, zoomTo: 1.05, fadeIn: 0.3, fadeOut: 0.3),
            .init(image: "\(dir)/shot02.png", duration: 3,
                  caption: "Tỉnh ghi nhận phê duyệt — chốt bản mốc v1", sub: nil, title: nil,
                  zoomFrom: 1.05, zoomTo: 1.0, fadeIn: 0.3, fadeOut: 0.6),
        ])
    try encode(manifest)
    try probe(manifest.output)
    try extractFrame(manifest.output, at: 4.0, to: "\(dir)/frame_caption.png")
    try extractFrame(manifest.output, at: 1.2, to: "\(dir)/frame_title.png")
}

// MARK: - main

let args = Array(CommandLine.arguments.dropFirst())
do {
    switch args.first {
    case "--probe":
        guard args.count >= 2 else { throw Err("dùng: --probe <file.mp4>") }
        try probe(args[1])
    case "--frame":
        guard args.count >= 4 else { throw Err("dùng: --frame <file.mp4> <giây> <out.png>") }
        try extractFrame(args[1], at: Double(args[2]) ?? 0, to: args[3])
    case "--selftest":
        try selftest(dir: args.count >= 2 ? args[1] : "./selftest")
    case .some(let path) where !path.hasPrefix("--"):
        let data = try Data(contentsOf: URL(fileURLWithPath: path))
        try encode(try JSONDecoder().decode(Manifest.self, from: data))
    default:
        print("dùng: mkvideo <manifest.json> | --probe <mp4> | --frame <mp4> <s> <png> | --selftest <dir>")
        exit(2)
    }
} catch {
    FileHandle.standardError.write("lỗi: \(error.localizedDescription)\n".data(using: .utf8)!)
    exit(1)
}
