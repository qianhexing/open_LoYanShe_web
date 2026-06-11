/** 窄屏竖持时通过 CSS 模拟横屏视口；并尝试 lock landscape（部分浏览器需全屏） */
export function useForcedLandscape(maxWidth = 768) {
    const isPortraitMobile = ref(false)

    const update = () => {
        if (import.meta.server) return
        const narrow = window.matchMedia(`(max-width: ${maxWidth - 1}px)`).matches
        isPortraitMobile.value = narrow && window.innerHeight > window.innerWidth
    }

    const tryLockLandscape = () => {
        if (import.meta.server) return
        const lock = screen.orientation?.lock
        if (!lock) return
        lock.call(screen.orientation, 'landscape').catch(() => {})
    }

    onMounted(() => {
        update()
        window.addEventListener('resize', update, { passive: true })
        window.addEventListener('orientationchange', update, { passive: true })
        tryLockLandscape()
    })

    onUnmounted(() => {
        if (import.meta.server) return
        window.removeEventListener('resize', update)
        window.removeEventListener('orientationchange', update)
        screen.orientation?.unlock?.()
    })

    return { isPortraitMobile }
}
