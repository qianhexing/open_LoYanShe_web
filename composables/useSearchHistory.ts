const STORAGE_KEY = 'history_keywords'
const MAX_ITEMS = 50

function readRaw(): string[] {
  if (!import.meta.client) return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : []
  } catch {
    return []
  }
}

function writeRaw(list: string[]) {
  if (!import.meta.client) return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
}

/** 搜索历史（与旧版 App localStorage 键名一致） */
export function useSearchHistory() {
  const keywords = ref<string[]>([])

  function refresh() {
    keywords.value = readRaw()
  }

  function add(keyword: string) {
    const trimmed = keyword.trim()
    if (!trimmed) return
    const next = readRaw().filter((item) => item !== trimmed)
    next.unshift(trimmed)
    if (next.length > MAX_ITEMS) next.length = MAX_ITEMS
    writeRaw(next)
    keywords.value = next
  }

  function remove(keyword: string) {
    const next = readRaw().filter((item) => item !== keyword)
    writeRaw(next)
    keywords.value = next
  }

  function clear() {
    writeRaw([])
    keywords.value = []
  }

  if (import.meta.client) {
    refresh()
  }

  return {
    keywords,
    refresh,
    add,
    remove,
    clear,
  }
}
