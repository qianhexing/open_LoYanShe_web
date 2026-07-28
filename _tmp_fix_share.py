from pathlib import Path

p = Path(r"d:\work\open_LoYanShe_web\components\matching\MatchingShareImage.vue")
text = p.read_text(encoding="utf-8")
old = '''/** 上：全宽主图 aspect 4:3；下：3 列方格 */
function buildBottomThumbGrid(width: number, count: number, y0: number): { rects: CollageRect[]; blockHeight: number } {
  if (count <= 0) return { rects: [], blockHeight: 0 }
  const cols = 3
  const colWs = divideEvenly(width, cols)
  const cellH = Math.min(colWs[0]!, colWs[1]!, colWs[2]!)
  const rows = Math.ceil(count / cols)
  const rects: CollageRect[] = []
  let idx = 0
  for (let r = 0; r < rows; r++) {
    let x = 0
    for (let c = 0; c < cols && idx < count; c++) {
      const cw = colWs[c] ?? cellH
      rects.push({ x, y: y0 + r * (cellH + BLOCK_GAP), w: cw, h: cellH })
      x += cw + (c < cols - 1 ? 0 : 0)
      // restore gap between columns
      if (c < cols - 1) {
        // colWs already partition full width without gaps; keep contiguous like before
      }
      idx++
    }
  }
  // Re-build with gaps between cells for a softer look
  const gap = BLOCK_GAP
  const innerW = width - gap * (cols - 1)
  const colWsGapped = divideEvenly(innerW, cols)
  const cellHG = Math.min(...colWsGapped)
  const rectsG: CollageRect[] = []
  let gi = 0
  for (let r = 0; r < rows; r++) {
    let x = 0
    for (let c = 0; c < cols && gi < count; c++) {
      const cw = colWsGapped[c] ?? cellHG
      rectsG.push({ x, y: y0 + r * (cellHG + gap), w: cw, h: cellHG })
      x += cw + gap
      gi++
    }
  }
  const blockHeight = rows * cellHG + Math.max(0, rows - 1) * gap
  return { rects: rectsG, blockHeight }
}'''
new = '''/** 上：全宽主图 aspect 4:3；下：3 列方格（格间留缝） */
function buildBottomThumbGrid(width: number, count: number, y0: number): { rects: CollageRect[]; blockHeight: number } {
  if (count <= 0) return { rects: [], blockHeight: 0 }
  const cols = 3
  const gap = BLOCK_GAP
  const innerW = width - gap * (cols - 1)
  const colWs = divideEvenly(innerW, cols)
  const cellH = Math.min(...colWs)
  const rows = Math.ceil(count / cols)
  const rects: CollageRect[] = []
  let idx = 0
  for (let r = 0; r < rows; r++) {
    let x = 0
    for (let c = 0; c < cols && idx < count; c++) {
      const cw = colWs[c] ?? cellH
      rects.push({ x, y: y0 + r * (cellH + gap), w: cw, h: cellH })
      x += cw + gap
      idx++
    }
  }
  const blockHeight = rows * cellH + Math.max(0, rows - 1) * gap
  return { rects, blockHeight }
}'''
if old not in text:
    raise SystemExit("old block not found")
text = text.replace(old, new, 1)
text = text.replace("  primaryDeep: '#e8899f',\n", "")
p.write_text(text, encoding="utf-8")
print("ok")
