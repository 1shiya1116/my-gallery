"""Generate PWA icon PNG files (stdlib only)."""
from __future__ import annotations

import struct
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent / "icons"
BG = (37, 99, 235)
WHITE = (255, 255, 255)
FRAME = (30, 64, 175)
SKY = (147, 197, 253)
HILL = (191, 219, 254)
SUN = (250, 204, 21)


def _clamp(value: int) -> int:
    return max(0, min(255, value))


def set_px(data: bytearray, size: int, x: int, y: int, color: tuple[int, int, int]) -> None:
    if x < 0 or y < 0 or x >= size or y >= size:
        return
    i = (y * size + x) * 4
    data[i : i + 4] = bytes([color[0], color[1], color[2], 255])


def fill_rect(data: bytearray, size: int, x0: int, y0: int, x1: int, y1: int, color: tuple[int, int, int]) -> None:
    for y in range(y0, y1):
        for x in range(x0, x1):
            set_px(data, size, x, y, color)


def fill_circle(data: bytearray, size: int, cx: int, cy: int, radius: int, color: tuple[int, int, int]) -> None:
    r2 = radius * radius
    for y in range(cy - radius, cy + radius + 1):
        for x in range(cx - radius, cx + radius + 1):
            if (x - cx) ** 2 + (y - cy) ** 2 <= r2:
                set_px(data, size, x, y, color)


def draw_icon(size: int) -> bytes:
    data = bytearray(size * size * 4)
    fill_rect(data, size, 0, 0, size, size, BG)

    margin = int(size * 0.18)
    inner = int(size * 0.08)
    x0, y0 = margin, margin
    x1, y1 = size - margin, size - margin
    fill_rect(data, size, x0, y0, x1, y1, WHITE)

    border = max(2, int(size * 0.03))
    for t in range(border):
        fill_rect(data, size, x0 + t, y0 + t, x1 - t, y0 + t + 1, FRAME)
        fill_rect(data, size, x0 + t, y1 - t - 1, x1 - t, y1 - t, FRAME)
        fill_rect(data, size, x0 + t, y0 + t, x0 + t + 1, y1 - t, FRAME)
        fill_rect(data, size, x1 - t - 1, y0 + t, x1 - t, y1 - t, FRAME)

    fill_circle(data, size, x0 + inner + int(size * 0.18), y0 + int(size * 0.55), int(size * 0.22), HILL)
    fill_circle(data, size, x0 + inner + int(size * 0.42), y0 + int(size * 0.48), int(size * 0.25), SKY)
    fill_circle(data, size, x1 - inner - int(size * 0.12), y0 + inner + int(size * 0.12), int(size * 0.06), SUN)

    raw = bytearray()
    for y in range(size):
        raw.append(0)
        raw.extend(data[y * size * 4 : (y + 1) * size * 4])

    compressed = zlib.compress(bytes(raw), 9)

    def chunk(tag: bytes, payload: bytes) -> bytes:
        crc = zlib.crc32(tag + payload) & 0xFFFFFFFF
        return struct.pack(">I", len(payload)) + tag + payload + struct.pack(">I", crc)

    ihdr = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)
    return b"".join(
        [
            b"\x89PNG\r\n\x1a\n",
            chunk(b"IHDR", ihdr),
            chunk(b"IDAT", compressed),
            chunk(b"IEND", b""),
        ]
    )


def main() -> None:
    ROOT.mkdir(parents=True, exist_ok=True)
    for name, size in (("icon-192.png", 192), ("icon-512.png", 512), ("apple-touch-icon.png", 180)):
        path = ROOT / name
        path.write_bytes(draw_icon(size))
        print(f"Wrote {path}")


if __name__ == "__main__":
    main()
