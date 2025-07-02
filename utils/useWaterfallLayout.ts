// utils/useWaterfallLayout.ts
export interface WaterfallItemStyle {
  index: number
  top: number
  left: number
  width: number
  height: number
}

export function useWaterfallLayout(selector: string, columnCount: number): WaterfallItemStyle[] {
  const container = document.querySelector(selector)?.parentElement
  if (!container) return []

  const items = document.querySelectorAll<HTMLElement>(selector)
  const containerWidth = container.clientWidth
  const columnWidth = items[0]?.offsetWidth || 0
  const columnGap = (containerWidth - columnWidth * columnCount) / (columnCount - 1)

  const columnHeights: number[] = new Array(columnCount).fill(0)
  const layoutResult: WaterfallItemStyle[] = []

  items.forEach((item, index) => {
    const minColumnIndex = columnHeights.indexOf(Math.min(...columnHeights))
    const top = columnHeights[minColumnIndex]
    const left = (columnWidth + columnGap) * minColumnIndex

    layoutResult.push({
      index,
      top,
      left,
      width: columnWidth,
      height: item.offsetHeight,
    })

    columnHeights[minColumnIndex] += item.offsetHeight + columnGap
  })
  const maxColumnIndex = columnHeights.indexOf(Math.max(...columnHeights))
  
  container.style.height = `${columnHeights[maxColumnIndex]}px`
  return layoutResult
}
