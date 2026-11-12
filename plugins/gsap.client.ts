/**
 * 不再全局同步注册 gsap（会拖慢每个 App WebView 冷启动）。
 * 需要动画的页面请：`const { gsap } = await loadGsap()`（见 utils/gsapLazy.ts）。
 */
export default defineNuxtPlugin(() => {
	return {
		provide: {
			gsap: null as null,
			ScrollTrigger: null as null,
		},
	}
})
