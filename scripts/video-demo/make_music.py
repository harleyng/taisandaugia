"""Nhạc nền tổng hợp cho video demo "Kế hoạch đấu giá".

Pad mềm, không lời, tự sinh hoàn toàn (chỉ dùng thư viện chuẩn) nên không
vướng bản quyền. Âm lượng để thấp vì video có phụ đề, không có thuyết minh.
"""
import math, struct, wave, sys

SR = 44100
# Am - F - C - G, mỗi hợp âm 8 giây; một vòng 32 giây.
CHORDS = [
    (220.00, 261.63, 329.63),   # Am
    (174.61, 220.00, 261.63),   # F
    (196.00, 246.94, 329.63),   # C/G
    (196.00, 246.94, 293.66),   # G
]
CHORD_SEC = 8.0


def env(t, dur, attack=2.2, release=2.8):
    """Vào/ra thật chậm để các hợp âm tan vào nhau."""
    if t < attack:
        return (t / attack) ** 1.6
    if t > dur - release:
        return max(0.0, ((dur - t) / release)) ** 1.6
    return 1.0


def render(total_sec):
    n = int(SR * total_sec)
    left = [0.0] * n
    right = [0.0] * n
    cycle = len(CHORDS) * CHORD_SEC

    for i in range(len(CHORDS) * int(math.ceil(total_sec / cycle)) + 1):
        start = i * CHORD_SEC
        if start >= total_sec:
            break
        freqs = CHORDS[i % len(CHORDS)]
        s0 = int(start * SR)
        s1 = min(n, int((start + CHORD_SEC + 2.0) * SR))  # chồng lấn 2s
        for k, f in enumerate(freqs):
            # lệch nhẹ hai kênh cho rộng tiếng, không chói
            for ch, detune in ((left, 1.0 - 0.0012 * k), (right, 1.0 + 0.0012 * k)):
                w = 2 * math.pi * f * detune / SR
                amp = 0.30 / (k + 1.35)
                for s in range(s0, s1):
                    t = (s - s0) / SR
                    e = env(t, CHORD_SEC + 2.0)
                    if e <= 0:
                        continue
                    ch[s] += amp * e * (
                        math.sin(w * (s - s0))
                        + 0.22 * math.sin(2 * w * (s - s0))   # bội âm 2
                        + 0.07 * math.sin(3 * w * (s - s0))   # bội âm 3
                    )

    # lọc thông thấp một cực: bỏ cạnh gắt của sóng sin cộng dồn
    a = 0.14
    for ch in (left, right):
        prev = 0.0
        for s in range(n):
            prev += a * (ch[s] - prev)
            ch[s] = prev

    # fade toàn bài + chuẩn hoá về khoảng -18 dBFS
    fade = int(3.0 * SR)
    for s in range(n):
        g = 1.0
        if s < fade:
            g = s / fade
        elif s > n - fade:
            g = max(0.0, (n - s) / fade)
        left[s] *= g
        right[s] *= g

    peak = max(1e-9, max(max(abs(v) for v in left), max(abs(v) for v in right)))
    target = 10 ** (-18 / 20)
    g = target / peak
    return [v * g for v in left], [v * g for v in right]


def write(path, total_sec):
    left, right = render(total_sec)
    with wave.open(path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        frames = bytearray()
        for l, r in zip(left, right):
            frames += struct.pack("<hh", int(max(-1, min(1, l)) * 32767),
                                        int(max(-1, min(1, r)) * 32767))
        w.writeframes(bytes(frames))


if __name__ == "__main__":
    out = sys.argv[1]
    dur = float(sys.argv[2]) if len(sys.argv) > 2 else 96.0
    write(out, dur)
    print(f"wrote {out} ({dur:.0f}s)")
