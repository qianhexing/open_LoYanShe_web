
// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
	hooks: {
		// 将 @nuxt/ui 自动注册的组件全部设为仅客户端渲染，避免 SSR 阶段 Teleport/插槽等与 Vue 实例相关的 500（如 reading 'ce'）
		'components:extend'(components) {
			for (const component of components) {
				const fp = component.filePath?.replace(/\\/g, '/') ?? ''
				if (/\/node_modules\/@nuxt\/ui\//.test(fp)) {
					component.mode = 'client'
				}
			}
		},
		// 去掉 @nuxt/ui 的 useToast，避免和 Qhx 提示抢同一个名字。
		'imports:extend'(imports) {
			const fromPath = (item: { from?: string }) =>
				String(item.from || '').replace(/\\/g, '/')
			const isNamed = (item: { name?: string; as?: string }, name: string) =>
				item.name === name || item.as === name

			for (let i = imports.length - 1; i >= 0; i--) {
				const item = imports[i]
				const from = fromPath(item)
				if (isNamed(item, 'useToast') && from.includes('@nuxt/ui')) {
					imports.splice(i, 1)
					continue
				}
				if (from.replace(/\\/g, '/').includes('/composables/useToast')) {
					imports.splice(i, 1)
				}
			}

			const hasUseToast = imports.some((item) => isNamed(item, 'useToast'))
			if (!hasUseToast) {
				imports.push({
					from: '~/composables/useQhxToast',
					name: 'useQhxToast',
					as: 'useToast',
				})
			}
			const hasShowToast = imports.some((item) => isNamed(item, 'showToast'))
			if (!hasShowToast) {
				imports.push({
					from: '~/utils/qhxToast',
					name: 'showToast',
					as: 'showToast',
				})
			}
		},
	},
	pages: true,
	vue: {
		compilerOptions: {
			isCustomElement: (tag) => tag.startsWith('a-')
		}
	},
	build: {
    transpile: ['three', 'mind-ar', 'heic-to']
  },
	vite: {
		build: {
			rollupOptions: {
				output: {
					manualChunks(id) {
						const normalized = id.replace(/\\/g, '/')
						// 强制把 Vite preload helper 留在独立小包，避免和 three/spark 粘成 8MB 共享入口
						if (
							normalized.includes('vite/preload-helper') ||
							normalized.includes('\0vite/preload-helper')
						) {
							return 'vite-preload'
						}
						if (!normalized.includes('node_modules')) return
						if (normalized.includes('@sparkjsdev/spark')) return 'vendor-spark'
						if (normalized.includes('/three/') || normalized.endsWith('/three')) {
							return 'vendor-three'
						}
						if (normalized.includes('ammo.js') || normalized.includes('/ammo/')) {
							return 'vendor-ammo'
						}
						if (normalized.includes('gsap')) return 'vendor-gsap'
						if (normalized.includes('@tiptap') || normalized.includes('prosemirror')) {
							return 'vendor-tiptap'
						}
						if (normalized.includes('echarts') || normalized.includes('zrender')) {
							return 'vendor-echarts'
						}
						if (normalized.includes('mind-ar')) return 'vendor-mind-ar'
					},
				},
			},
		},
		// linkedom 主入口会拉 commonjs/canvas.cjs（含 require）；SSR 插件只用 linkedom/worker
		ssr: {
			external: ['linkedom', 'linkedom/worker', 'canvas'],
		},
	},
	nitro: {
		routeRules: {
			'/wardrobe/**': { ssr: false },
			// 服饰 / 我的手账 / 我的搭配 / 搭配详情 / 我的计划：App WebView 冷启动，不走 SSR
			'/clothes/**': { ssr: false },
			'/journal': { ssr: false },
			'/journal/**': { ssr: false },
			'/matching': { ssr: false },
			'/matching/**': { ssr: false },
			'/user/plan': { ssr: false },
			'/community/detail/**': { ssr: false },
			'/community/post': { ssr: false },
			'/library/detail/**': { ssr: false },
			'/shop/detail/**': { ssr: false },
			'/node/**': {
				proxy: 'https://lolitalibrary.com/node/**'
			},
			// '/node/**': {
			// 	proxy: 'http://192.168.1.23:3002/**'
			// },
			'/ali/**': {
				proxy: 'http://image.lolitalibrary.com/**'
			},
			'/pc/**': {
				proxy: 'https://lolitalibrary.com/pc/**'
			},
			// '/**': {
			// 	headers: {
			// 		'Cross-Origin-Opener-Policy': 'same-origin',
			// 		'Cross-Origin-Embedder-Policy': 'require-corp',
			// 	}
			// }
		},
		compressPublicAssets: true, // 启动压缩
		/**
		 * 生产 SSR 为 ESM：若仍有 CJS 被 inline 且残留 require()，
		 * 注入 createRequire，避免 `require is not defined in ES module scope`。
		 * 已自带 createRequire 的 chunk 跳过，防止重复声明。
		 */
		hooks: {
			'rollup:before'(_nitro, config) {
				const plugins = config.plugins ?? []
				config.plugins = [
					...plugins,
					{
						name: 'inject-cjs-require-for-esm',
						renderChunk(code: string) {
							if (!/\brequire\s*\(/.test(code)) return null
							if (/\bcreateRequire\b/.test(code) && /\brequire\s*=/.test(code)) {
								return null
							}
							return {
								code:
									'import { createRequire } from \'node:module\';\n' +
									'const require = createRequire(import.meta.url);\n' +
									code,
								map: null,
							}
						},
					},
				]
			},
		},
	},
	
	runtimeConfig: {
		public: {
			//这是后端API的baseUrl
			baseUrl: '/node'
		}
	},
	app: {
		// 暂时不走 CDN：静态资源同源 /_nuxt（恢复时改回下方生产默认地址）
		// 原：https://image.lolitalibrary.com/tool/nuxt/
		cdnURL: process.env.NUXT_APP_CDN_URL ?? '',
    head: {
			meta: [
        { 
          name: 'viewport', 
          content: 'width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no, viewport-fit=cover' 
        },
        // 阻止 iOS Safari / WKWebView 在系统暗色下改写默认文字色与表单控件色
        { name: 'color-scheme', content: 'light only' },
      ],
      script: [
        // 只在生产环境加载百度统计
        ...(process.env.NODE_ENV === 'production' ? [
          {
            src: 'https://hm.baidu.com/hm.js?0335ae083b2ed0e0898bed7618373dee',
            async: true,
            defer: true,
            onerror: 'this.onerror=null;', // 静默处理加载错误
          },
        ] : []),
      ],
    },
  },
	compatibilityDate: '2024-11-01',
	devtools: { enabled: process.env.NODE_ENV !== 'production' },
	// 关掉 NuxtLink 视口预取，避免导航栏/列表链接触发上百个路由 chunk 请求
	experimental: {
		defaults: {
			nuxtLink: {
				prefetch: false,
			},
		},
	},
	i18n: {
    locales: [
			{
        code: 'zh',
        name: '中文',
        file: 'zh.json'
      },
      {
        code: 'en',
        name: 'English',
        file: 'en.json'
      },
			{
        code: 'ja',
        name: '日本語',
        file: 'ja.json'
      }
    ],
    defaultLocale: 'zh',
    lazy: true, // 懒加载语言包
    langDir: 'locales/', // 放语言 JSON 的目录
    // strategy: 'prefix_except_default', // URL 前缀策略

		strategy: 'no_prefix',
		// 相对 i18n/ 目录（restructureDir），即 i18n/i18n.config.ts
		vueI18n: 'i18n.config.ts',
    detectBrowserLanguage: {
      cookieKey: 'i18n_redirected',
			useCookie: false,      // 不自动跳转
      alwaysRedirect: true,
      fallbackLocale: 'zh'
    }
  },
	modules: ['@nuxtjs/seo', '@nuxt/ui', '@nuxtjs/tailwindcss', '@vueuse/nuxt', '@pinia/nuxt', '@nuxtjs/i18n'],
	// @nuxtjs/seo 会带上 nuxt-og-image → @resvg 全平台原生包（约 40MB+），项目未用 defineOgImage，关掉以免 server 产物膨胀
	ogImage: {
		enabled: false,
	},
	imports: {
    autoImport: true,
		dirs: ['stores', 'directives']
  },
	colorMode: {
		// 全站强制浅色：勿用 system，否则 iOS 暗色会挂 .dark 并改写字体色
		preference: 'light',
		fallback: 'light',
		classSuffix: ''
	},
	
	css: [
    '~/assets/css/tailwind.css'   // 再加载Tailwind
  ],
	
	tailwindcss: {
		config: {
			theme: {
				extend: {
					colors: {
						/**
						 * 必须用 hex：app.config primary='pink' 时 Nuxt UI 会把 pink 转成
						 * --color-primary-*；写成 var(--color-pink-*) 会得到 null，主按钮透明。
						 * 动态主题走 qhx-primary / --primary-color，不要把 pink 绑到未包装的 RGB 变量。
						 */
						pink: {
							50: '#FFF0F4',
							100: '#FFE1EA',
							200: '#FFC8D6',
							300: '#FFAFC4',
							400: '#FF96B2',
							500: '#FF9EB5',
							600: '#E67896',
							700: '#C85A78',
							800: '#AA3C5A',
							900: '#8C2841',
							950: '#641428',
							DEFAULT: '#FF9EB5'
						},
						// 自定义主色调 - 粉色系
						primary: {
							50: '#FFF0F4',
							100: '#FFE1EA',
							200: '#FFC8D6',
							300: '#FFAFC4',
							400: '#FF96B2',
							500: '#FF9EB5', // 基准色
							600: '#E67896',
							700: '#C85A78',
							800: '#AA3C5A',
							900: '#8C2841',
							950: '#641428',
							DEFAULT: '#FF9EB5'
						},
						// 自定义灰色系
						gray: {
							50: '#F9FAFB',
							100: '#F3F4F6',
							200: '#E5E7EB',
							300: '#D1D5DB',
							400: '#9CA3AF',
							500: '#6B7280',
							600: '#4B5563',
							700: '#374151',
							800: '#1F2937',
							900: '#111827',
							950: '#030712',
							DEFAULT: '#6B7280'
						},
						// 基础颜色变量（带 fallback，避免主题 apply 前透明）
						'qhx-primary': 'var(--primary-color, #FF9EB5)',
						'qhx-primaryHover': 'var(--primaryHover-color, #FFB3C6)',
						'qhx-inverted': 'var(--inverted-color, #ffffff)',
						'qhx-secondary': 'var(--secondary-color, #A5D8FF)',
						'qhx-accent': 'var(--accent-color, #B5EAD7)',
						
						// 背景和文字
						'qhx-bg': 'var(--background-color, #FFF9FB)',
						'qhx-bg-card': 'var(--card-color, #FFFFFF)',
						'qhx-text': 'var(--text-color, #000000)',
						'qhx-textBg': 'var(--textBg-color, #212121)',
						'qhx-text-muted': 'var(--textSecondary-color, #9B8A97)',
						'qhx-textInverted': 'var(--textInverted-color, #FFFFFF)',
						
						// 状态色
						'qhx-success': 'var(--success-color, #B5EAD7)',
						'qhx-warning': 'var(--warning-color, #FFD700)',
						'qhx-danger': 'var(--error-color, #df2343)',
						'qhx-info': 'var(--info-color, #A5D8FF)',
						
						// 灰度
						'qhx-border': 'var(--border-color, #FFD1DC)',
						'qhx-divider': 'var(--divider-color, #FFE5EE)'
					},
				}
			}
		}
	},
	devServer: {
		port: 3000
	}
})
