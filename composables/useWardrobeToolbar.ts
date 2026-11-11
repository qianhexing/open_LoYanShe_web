import {
  WARDROBE_TOOLBAR_TOOLS,
  getConfigurableToolbarTools,
  getWardrobeToolbarTool,
  persistToolbarPrefs,
  readToolbarPrefs,
  sortToolbarToolsByOrder,
  type WardrobeToolbarPlacement,
  type WardrobeToolbarPrefs,
  type WardrobeToolbarToolId,
  type WardrobeToolbarToolMeta,
} from '~/utils/wardrobeToolbarConfig'

export function useWardrobeToolbar() {
  const { t } = useI18n()
  const prefs = ref<WardrobeToolbarPrefs>(readToolbarPrefs())

  const configurableTools = getConfigurableToolbarTools()

  const placements = computed(() => prefs.value.placements)

  function localizeTool(tool: WardrobeToolbarToolMeta): WardrobeToolbarToolMeta {
    return {
      ...tool,
      label: t(`wardrobe.toolbar.${tool.id}`),
      moreDescription: tool.moreDescription
        ? t(`wardrobe.toolbar.${tool.id}_desc`)
        : tool.moreDescription,
    }
  }

  const sidebarTools = computed((): WardrobeToolbarToolMeta[] => {
    const filtered = WARDROBE_TOOLBAR_TOOLS.filter((tool) => prefs.value.placements[tool.id] === 'sidebar')
    return sortToolbarToolsByOrder(filtered, prefs.value.order).map(localizeTool)
  })

  const moreTools = computed((): WardrobeToolbarToolMeta[] => {
    const filtered = WARDROBE_TOOLBAR_TOOLS.filter((tool) => prefs.value.placements[tool.id] === 'more')
    return sortToolbarToolsByOrder(filtered, prefs.value.order).map(localizeTool)
  })

  const orderedConfigTools = computed((): WardrobeToolbarToolMeta[] =>
    prefs.value.order
      .map((id) => getWardrobeToolbarTool(id))
      .filter((tool): tool is WardrobeToolbarToolMeta => !!tool)
      .map(localizeTool),
  )

  const toolbarOrderRows = computed({
    get: () => prefs.value.order.map((id) => ({ id })),
    set: (rows: Array<{ id: WardrobeToolbarToolId }>) => {
      prefs.value = {
        ...prefs.value,
        order: rows.map((row) => row.id),
      }
    },
  })

  const showMoreButton = computed(() => moreTools.value.length > 0)

  function setPlacement(id: WardrobeToolbarToolId, placement: WardrobeToolbarPlacement) {
    const tool = getWardrobeToolbarTool(id)
    if (!tool || tool.placementLocked) return
    if (prefs.value.placements[id] === placement) return
    prefs.value = {
      ...prefs.value,
      placements: { ...prefs.value.placements, [id]: placement },
    }
  }

  function restorePrefs() {
    prefs.value = readToolbarPrefs()
  }

  watch(
    prefs,
    (value) => {
      persistToolbarPrefs(value)
    },
    { deep: true },
  )

  return {
    prefs,
    placements,
    configurableTools,
    orderedConfigTools,
    toolbarOrderRows,
    sidebarTools,
    moreTools,
    showMoreButton,
    setPlacement,
    restorePrefs,
  }
}
