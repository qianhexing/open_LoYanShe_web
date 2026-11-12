/**
 * 按需加载 gsap，避免全局 plugin 把动画库打进每个 WebView 入口包。
 */
import type gsap from 'gsap'
import type { ScrollTrigger as ScrollTriggerType } from 'gsap/ScrollTrigger'

type Gsap = typeof gsap
type ScrollTriggerNs = typeof ScrollTriggerType

let gsapMod: Gsap | null = null
let scrollTriggerMod: ScrollTriggerNs | null = null
let loadPromise: Promise<{ gsap: Gsap; ScrollTrigger: ScrollTriggerNs }> | null = null

export function loadGsap(): Promise<{ gsap: Gsap; ScrollTrigger: ScrollTriggerNs }> {
	if (gsapMod && scrollTriggerMod) {
		return Promise.resolve({ gsap: gsapMod, ScrollTrigger: scrollTriggerMod })
	}
	if (!loadPromise) {
		loadPromise = Promise.all([import('gsap'), import('gsap/ScrollTrigger')]).then(
			([gsapModule, stModule]) => {
				gsapMod = gsapModule.default
				scrollTriggerMod = stModule.ScrollTrigger
				gsapMod.registerPlugin(scrollTriggerMod)
				return { gsap: gsapMod, ScrollTrigger: scrollTriggerMod }
			},
		)
	}
	return loadPromise
}

/** threeCore 等已 ensure 过之后的同步访问 */
export function getGsap(): Gsap {
	if (!gsapMod) {
		throw new Error('[gsapLazy] call await loadGsap() before getGsap()')
	}
	return gsapMod
}

export function tryGetGsap(): Gsap | null {
	return gsapMod
}
