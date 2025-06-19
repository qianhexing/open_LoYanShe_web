// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
	build: {
    transpile: ['three']
  },
	nitro: {
		routeRules: {
			// '/node/**': {
			// 	proxy: 'https://lolitalibrary.com/node/**'
			// }
			'/node/**': {
				proxy: 'http://192.168.1.23:3002/**'
			}
		},
		compressPublicAssets: true // 启动压缩
	},
	
	runtimeConfig: {
		public: {
			//这是后端API的baseUrl
			baseUrl: '/node'
		}
	},
	compatibilityDate: '2024-11-01',
	devtools: { enabled: true },
	modules: ['@nuxtjs/seo', '@nuxt/ui', '@nuxtjs/tailwindcss', '@vueuse/nuxt', '@pinia/nuxt'],
	imports: {
    autoImport: true,
		dirs: ['stores']
  },
	colorMode: {
		preference: 'system',
		fallback: 'light',
		classSuffix: ''
	},
	css: [
    '~/assets/css/tailwind.css'   // 再加载Tailwind
  ],
	tailwindcss: {
		config: {
			theme: {
				// extend: {
				// 	colors: {
				// 		primary: '#3B82F6',
				// 		secondary: '#10B981'
				// 		// 您可以根据需要添加更多自定义颜色
				// 	}
				// }
				extend: {
					colors: {
						// 基础颜色变量
						'qhx-primary': 'var(--primary-color)',
						'qhx-primaryHover': 'var(--primary-color)',
						'qhx-inverted': 'var(--inverted-color)',
						'qhx-secondary': 'var(--primaryHover-color)',
						'qhx-accent': 'var(--accent-color)',
						
						// 背景和文字
						'qhx-bg': 'var(--background-color)',
						'qhx-bg-card': 'var(--card-color)',
						'qhx-text': 'var(--text-color)',
						'qhx-text-muted': 'var(--text-muted-color)',
						'qhx-textInverted': 'var(--textInverted-color)',
						// 状态色
						'qhx-success': 'var(--success-color)',
						'qhx-warning': 'var(--warning-color)',
						'qhx-danger': 'var(--danger-color)',
						'qhx-info': 'var(--info-color)',
						
						// 灰度
						'qhx-border': 'var(--border-color)',
						'qhx-divider': 'var(--divider-color)'
					},
				}
			}
		}
	},
	devServer: {
		port: 3000
	}
})
