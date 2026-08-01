#!/usr/bin/env node
// Generates electron-assets/icon.png (512x512) — a stylized flowchart icon.
// Pure Node, zero dependencies. Rerun anytime:  node scripts/generate-icon.mjs
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SIZE = 512
const SS = 3 // supersample factor
const W = SIZE * SS

// ---------------------------------------------------------------------------
// Shape helpers (all coordinates normalized to [0,1])
// ---------------------------------------------------------------------------
const lerp = (a, b, t) => a + (b - a) * t

function inRoundedRect(x, y, cx, cy, w, h, rad) {
  const hw = w / 2
  const hh = h / 2
  const dx = Math.abs(x - cx) - (hw - rad)
  const dy = Math.abs(y - cy) - (hh - rad)
  if (dx <= 0 && dy <= 0) return true
  return dx * dx + dy * dy <= rad * rad
}

function distToSegment(px, py, x1, y1, x2, y2) {
  const vx = x2 - x1
  const vy = y2 - y1
  const wx = px - x1
  const wy = py - y1
  const len2 = vx * vx + vy * vy || 1
  const t = Math.max(0, Math.min(1, (wx * vx + wy * vy) / len2))
  return Math.hypot(px - (x1 + t * vx), py - (y1 + t * vy))
}

function inTriangle(px, py, [ax, ay], [bx, by], [cx, cy]) {
  const s1 = (bx - ax) * (py - ay) - (by - ay) * (px - ax)
  const s2 = (cx - bx) * (py - by) - (cy - by) * (px - bx)
  const s3 = (ax - cx) * (py - cy) - (ay - cy) * (px - cx)
  const neg = s1 < 0 || s2 < 0 || s3 < 0
  const pos = s1 > 0 || s2 > 0 || s3 > 0
  return !(neg && pos)
}

// Arrowhead triangle at line end (ex, ey), pointing back toward (sx, sy)
function arrowTriangle(sx, sy, ex, ey, len, halfWidth) {
  const dx = ex - sx
  const dy = ey - sy
  const d = Math.hypot(dx, dy) || 1
  const ux = dx / d
  const uy = dy / d
  const bx = ex - ux * len
  const by = ey - uy * len
  const px = -uy * halfWidth
  const py = ux * halfWidth
  return [
    [ex, ey],
    [bx + px, by + py],
    [bx - px, by - py],
  ]
}

// ---------------------------------------------------------------------------
// Icon composition — a small flow: A ─┐  B ─┐  converging on C
// ---------------------------------------------------------------------------
const nodeA = { x: 0.26, y: 0.28, w: 0.26, h: 0.185, rad: 0.05 }
const nodeB = { x: 0.74, y: 0.28, w: 0.26, h: 0.185, rad: 0.05 }
const nodeC = { x: 0.5, y: 0.72, w: 0.3, h: 0.19, rad: 0.05 }

const EDGE_A = [0.26, 0.3725, 0.42, 0.625] // A bottom → C top-left
const EDGE_B = [0.74, 0.3725, 0.58, 0.625] // B bottom → C top-right
const EDGE_W = 0.017
const STROKE_W = 0.014
const TRI_A = arrowTriangle(...EDGE_A, 0.055, 0.032)
const TRI_B = arrowTriangle(...EDGE_B, 0.055, 0.032)

const C_BG1 = [0x0f, 0x17, 0x2a] // slate-900
const C_BG2 = [0x1e, 0x29, 0x3b] // slate-800
const C_NODE = [0xf1, 0xf5, 0xf9] // slate-100
const C_STROKE = [0x25, 0x63, 0xeb] // blue-600
const C_EDGE = [0x38, 0xbd, 0xf8] // sky-400

function sample(nx, ny) {
  // background gradient
  const t = Math.min(1, Math.max(0, (nx + ny) / 2))
  const r = lerp(C_BG1[0], C_BG2[0], t)
  const g = lerp(C_BG1[1], C_BG2[1], t)
  const b = lerp(C_BG1[2], C_BG2[2], t)

  // edges + arrowheads (under the nodes)
  let isEdge =
    distToSegment(nx, ny, EDGE_A[0], EDGE_A[1], EDGE_A[2], EDGE_A[3]) <= EDGE_W / 2 ||
    distToSegment(nx, ny, EDGE_B[0], EDGE_B[1], EDGE_B[2], EDGE_B[3]) <= EDGE_W / 2
  if (isEdge || inTriangle(nx, ny, ...TRI_A) || inTriangle(nx, ny, ...TRI_B)) {
    return [C_EDGE[0], C_EDGE[1], C_EDGE[2], 255]
  }

  // nodes on top
  for (const n of [nodeA, nodeB, nodeC]) {
    const body = inRoundedRect(nx, ny, n.x, n.y, n.w, n.h, n.rad)
    const ring =
      !body && inRoundedRect(nx, ny, n.x, n.y, n.w + STROKE_W * 2, n.h + STROKE_W * 2, n.rad + STROKE_W)
    if (body) return [C_NODE[0], C_NODE[1], C_NODE[2], 255]
    if (ring) return [C_STROKE[0], C_STROKE[1], C_STROKE[2], 255]
  }
  return [r, g, b, 255]
}

// ---------------------------------------------------------------------------
// Render with supersampling, then box-downsample to SIZE x SIZE
// ---------------------------------------------------------------------------
const big = Buffer.alloc(W * W * 4)
for (let y = 0; y < W; y++) {
  const ny = (y + 0.5) / W
  for (let x = 0; x < W; x++) {
    const nx = (x + 0.5) / W
    const [r, g, b, a] = sample(nx, ny)
    const i = (y * W + x) * 4
    big[i] = r
    big[i + 1] = g
    big[i + 2] = b
    big[i + 3] = a
  }
}

const out = Buffer.alloc(SIZE * SIZE * 4)
const N = SS * SS
for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    let r = 0
    let g = 0
    let b = 0
    let a = 0
    for (let sy = 0; sy < SS; sy++) {
      for (let sx = 0; sx < SS; sx++) {
        const i = ((y * SS + sy) * W + (x * SS + sx)) * 4
        r += big[i]
        g += big[i + 1]
        b += big[i + 2]
        a += big[i + 3]
      }
    }
    const i = (y * SIZE + x) * 4
    out[i] = Math.round(r / N)
    out[i + 1] = Math.round(g / N)
    out[i + 2] = Math.round(b / N)
    out[i + 3] = Math.round(a / N)
  }
}

// ---------------------------------------------------------------------------
// PNG encode (RGBA8, no deps)
// ---------------------------------------------------------------------------
let CRC_TABLE
function crc32(buf) {
  if (!CRC_TABLE) {
    CRC_TABLE = new Int32Array(256)
    for (let n = 0; n < 256; n++) {
      let c = n
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      CRC_TABLE[n] = c
    }
  }
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const t = Buffer.from(type, 'ascii')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0)
  return Buffer.concat([len, t, data, crc])
}

function encodePNG(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type RGBA
  const stride = width * 4 + 1
  const raw = Buffer.alloc(stride * height)
  for (let y = 0; y < height; y++) {
    raw[y * stride] = 0 // filter: none
    rgba.copy(raw, y * stride + 1, y * width * 4, (y + 1) * width * 4)
  }
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])
}

const png = encodePNG(SIZE, SIZE, out)
mkdirSync(join(ROOT, 'electron-assets'), { recursive: true })
const dest = join(ROOT, 'electron-assets', 'icon.png')
writeFileSync(dest, png)
console.log(`Wrote ${dest} (${png.length} bytes)`)
