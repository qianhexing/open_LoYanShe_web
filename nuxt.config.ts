
// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
	pages: true,
	vue: {
		compilerOptions: {
			isCustomElement: (tag) => tag.startsWith('a-')
		}
	},
	build: {
    transpile: ['three', 'mind-ar']
  },
	nitro: {
		routeRules: {
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
		compressPublicAssets: true // 启动压缩
	},
	
	runtimeConfig: {
		public: {
			//这是后端API的baseUrl
			baseUrl: '/node'
		}
	},
	app: {
    head: {
			meta: [
        { 
          name: 'viewport', 
          content: 'width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no, viewport-fit=cover' 
        }
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
	devtools: { enabled: true },
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
    detectBrowserLanguage: {
      cookieKey: 'i18n_redirected',
			useCookie: false,      // 不自动跳转
      alwaysRedirect: true,
      fallbackLocale: 'zh'
    }
  },
	modules: ['@nuxtjs/seo', '@nuxt/ui', '@nuxtjs/tailwindcss', '@vueuse/nuxt', '@pinia/nuxt', '@nuxtjs/i18n'],
	imports: {
    autoImport: true,
		dirs: ['stores', 'directives']
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
				extend: {
					colors: {
						pink: {
							50: 'var(--color-pink-50)',
							100: 'var(--color-pink-100)',
							200: 'var(--color-pink-200)',
							300: 'var(--color-pink-300)',
							400: 'var(--color-pink-400)',
							500: 'var(--color-pink-500)', // 基准色
							600: 'var(--color-pink-600)',
							700: 'var(--color-pink-700)',
							800: 'var(--color-pink-800)',
							900: 'var(--color-pink-900)',
							950: 'var(--color-pink-950)',
							DEFAULT: 'var(--color-pink-500)'
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
						// 基础颜色变量
						'qhx-primary': 'var(--primary-color)',
						'qhx-primaryHover': 'var(--primary-color)',
						'qhx-inverted': 'var(--inverted-color)', // 反色与主色相对
						'qhx-secondary': 'var(--primaryHover-color)',
						'qhx-accent': 'var(--accent-color)',
						
						// 背景和文字
						'qhx-bg': 'var(--background-color)',
						'qhx-bg-card': 'var(--card-color)',
						'qhx-text': 'var(--text-color)',
						'qhx-textBg': 'var(--textBg-color)',
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
