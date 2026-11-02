/**
 * Qhx Toast：直接往 document.body 插入节点。
 * 不经过 Nuxt UI useToast / Vue Teleport，避免同名覆盖和宿主未挂载。
 */

export type ToastColor =
  | 'red'
  | 'green'
  | 'orange'
  | 'amber'
  | 'yellow'
  | 'primary'
  | 'blue'
  | 'gray'
  | 'white'
  | string

export interface ToastInput {
  id?: string | number
  title?: string
  description?: string
  icon?: string
  color?: ToastColor
  timeout?: number | false
}

export interface ToastItem {
  id: string
  title: string
  description: string
  icon: string
  color: string
  timeout: number
}

const HOST_ID = 'qhx-toast-host'
const STYLE_ID = 'qhx-toast-style'
const MAX_TOASTS = 5
const DEFAULT_TIMEOUT = 3200
const timers = new Map<string, ReturnType<typeof setTimeout>>()

function isBrowser() {
  return typeof document !== 'undefined'
}

function injectStyle() {
  let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null
  if (!style) {
    style = document.createElement('style')
    style.id = STYLE_ID
    document.head.appendChild(style)
  }
  style.textContent = `
#${HOST_ID} {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 2147483647;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  pointer-events: none;
  padding: max(0.5rem, env(safe-area-inset-top, 0px)) 12px 0;
  font-family: inherit;
}
.qhx-toast-item {
  pointer-events: auto;
  width: max-content;
  max-width: min(calc(100vw - 24px), 16.5rem);
  overflow: hidden;
  border-radius: 14px;
  border: 1px solid var(--border-color, #ffd1dc);
  background: var(--card-color, #fff);
  color: var(--text-color, #111827);
  box-shadow:
    0 10px 28px color-mix(in srgb, var(--primary-color, #ff9eb5) 16%, transparent),
    0 1px 4px rgba(17, 24, 39, 0.06);
  backdrop-filter: blur(12px) saturate(150%);
  -webkit-backdrop-filter: blur(12px) saturate(150%);
  transform-origin: top center;
  animation: qhx-toast-in 0.46s cubic-bezier(0.22, 1, 0.36, 1) both;
}
.qhx-toast-item.is-out {
  animation: qhx-toast-out 0.28s cubic-bezier(0.4, 0, 1, 1) both;
}
.qhx-toast-item[data-color="red"] {
  border-color: color-mix(in srgb, var(--error-color, #df2343) 38%, var(--border-color, #ffd1dc));
}
.qhx-toast-item[data-color="green"] {
  border-color: color-mix(in srgb, var(--success-color, #b5ead7) 70%, var(--border-color, #ffd1dc));
}
.qhx-toast-item[data-color="orange"],
.qhx-toast-item[data-color="amber"],
.qhx-toast-item[data-color="yellow"] {
  border-color: color-mix(in srgb, var(--warning-color, #ffd700) 55%, var(--border-color, #ffd1dc));
}
.qhx-toast-item[data-color="blue"] {
  border-color: color-mix(in srgb, var(--info-color, #a5d8ff) 70%, var(--border-color, #ffd1dc));
}
.qhx-toast-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px 7px;
}
.qhx-toast-icon {
  flex: none;
  width: 22px;
  height: 22px;
  border-radius: 999px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--primary-color, #ff9eb5) 14%, var(--card-color, #fff));
  color: var(--primary-color, #ff9eb5);
}
.qhx-toast-item[data-color="red"] .qhx-toast-icon {
  background: color-mix(in srgb, var(--error-color, #df2343) 12%, var(--card-color, #fff));
  color: var(--error-color, #df2343);
}
.qhx-toast-item[data-color="green"] .qhx-toast-icon {
  background: color-mix(in srgb, var(--success-color, #b5ead7) 35%, var(--card-color, #fff));
  color: color-mix(in srgb, var(--success-color, #b5ead7) 35%, #047857);
}
.qhx-toast-item[data-color="orange"] .qhx-toast-icon,
.qhx-toast-item[data-color="amber"] .qhx-toast-icon,
.qhx-toast-item[data-color="yellow"] .qhx-toast-icon {
  background: color-mix(in srgb, var(--warning-color, #ffd700) 28%, var(--card-color, #fff));
  color: color-mix(in srgb, var(--warning-color, #ffd700) 40%, #b45309);
}
.qhx-toast-item[data-color="blue"] .qhx-toast-icon {
  background: color-mix(in srgb, var(--info-color, #a5d8ff) 32%, var(--card-color, #fff));
  color: color-mix(in srgb, var(--info-color, #a5d8ff) 20%, #0369a1);
}
.qhx-toast-icon svg { width: 14px; height: 14px; }
.qhx-toast-body { min-width: 0; flex: 1; }
.qhx-toast-title {
  margin: 0;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.3;
  color: var(--text-color, #111827);
}
.qhx-toast-desc {
  margin: 2px 0 0;
  font-size: 11px;
  line-height: 1.4;
  color: var(--textSecondary-color, #9b8a97);
}
.qhx-toast-close {
  flex: none;
  width: 22px;
  height: 22px;
  margin: 0 -2px 0 0;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--textSecondary-color, #9b8a97);
  cursor: pointer;
  transition: background 0.2s ease, color 0.2s ease, transform 0.2s ease;
}
.qhx-toast-close:hover {
  background: color-mix(in srgb, var(--primary-color, #ff9eb5) 12%, transparent);
  color: var(--primary-color, #ff9eb5);
}
.qhx-toast-close:active { transform: scale(0.92); }
.qhx-toast-bar {
  height: 1.5px;
  width: 100%;
  transform-origin: center;
  background: var(--primary-color, #ff9eb5);
  opacity: 0.85;
  animation: qhx-toast-bar linear forwards;
  animation-duration: var(--qhx-toast-timeout, 3200ms);
}
.qhx-toast-item[data-color="red"] .qhx-toast-bar { background: var(--error-color, #df2343); }
.qhx-toast-item[data-color="green"] .qhx-toast-bar { background: var(--success-color, #b5ead7); }
.qhx-toast-item[data-color="orange"] .qhx-toast-bar,
.qhx-toast-item[data-color="amber"] .qhx-toast-bar,
.qhx-toast-item[data-color="yellow"] .qhx-toast-bar { background: var(--warning-color, #ffd700); }
.qhx-toast-item[data-color="blue"] .qhx-toast-bar { background: var(--info-color, #a5d8ff); }
.qhx-toast-item[data-timeout="0"] .qhx-toast-bar { display: none; }
@keyframes qhx-toast-in {
  0% { opacity: 0; transform: translateY(-18px) scale(0.92); }
  58% { opacity: 1; transform: translateY(4px) scale(1.03); }
  100% { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes qhx-toast-out {
  0% { opacity: 1; transform: translateY(0) scale(1); }
  100% { opacity: 0; transform: translateY(-12px) scale(0.96); }
}
@keyframes qhx-toast-bar {
  from { transform: scaleX(1); opacity: 0.9; }
  to { transform: scaleX(0); opacity: 0.35; }
}
@media (prefers-reduced-motion: reduce) {
  .qhx-toast-item,
  .qhx-toast-item.is-out,
  .qhx-toast-bar {
    animation: none !important;
  }
}
`
}

function ensureHost() {
  injectStyle()
  let host = document.getElementById(HOST_ID)
  if (host) return host
  host = document.createElement('div')
  host.id = HOST_ID
  host.setAttribute('aria-live', 'polite')
  document.body.appendChild(host)
  return host
}

function iconSvg(kind: 'check' | 'error' | 'warn' | 'info') {
  const paths: Record<typeof kind, string> = {
    check:
      '<path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />',
    error:
      '<path stroke-linecap="round" stroke-linejoin="round" d="m9.75 9.75 4.5 4.5m0-4.5-4.5 4.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />',
    warn:
      '<path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-.75 3.75h.008v.008H11.25V16.5ZM10.29 3.86 1.82 18a2.25 2.25 0 0 0 1.94 3.36h16.48A2.25 2.25 0 0 0 22.18 18L13.71 3.86a2.25 2.25 0 0 0-3.42 0Z" />',
    info:
      '<path stroke-linecap="round" stroke-linejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />',
  }
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">${paths[kind]}</svg>`
}

function iconKind(item: ToastItem): 'check' | 'error' | 'warn' | 'info' {
  if (item.icon.includes('check') || item.color === 'green') return 'check'
  if (item.icon.includes('x-circle') || item.color === 'red') return 'error'
  if (
    item.icon.includes('exclamation') ||
    item.color === 'amber' ||
    item.color === 'orange' ||
    item.color === 'yellow'
  ) {
    return 'warn'
  }
  return 'info'
}

function defaultIcon(color?: string): string {
  switch (color) {
    case 'green':
      return 'i-heroicons-check-circle'
    case 'red':
      return 'i-heroicons-x-circle'
    case 'orange':
    case 'amber':
    case 'yellow':
      return 'i-heroicons-exclamation-triangle'
    default:
      return 'i-heroicons-information-circle'
  }
}

export function removeQhxToast(id: string | number) {
  if (!isBrowser()) return
  const sid = String(id)
  const timer = timers.get(sid)
  if (timer) {
    clearTimeout(timer)
    timers.delete(sid)
  }
  const el = document.getElementById(`qhx-toast-${sid}`)
  if (!el) return
  if (el.classList.contains('is-out')) return
  el.classList.add('is-out')
  const done = () => el.remove()
  const onEnd = (event: AnimationEvent) => {
    if (event.target !== el) return
    if (event.animationName !== 'qhx-toast-out') return
    el.removeEventListener('animationend', onEnd)
    done()
  }
  el.addEventListener('animationend', onEnd)
  window.setTimeout(done, 360)
}

export function clearQhxToasts() {
  if (!isBrowser()) return
  for (const timer of timers.values()) clearTimeout(timer)
  timers.clear()
  const host = document.getElementById(HOST_ID)
  if (host) host.innerHTML = ''
}

export function addQhxToast(input: ToastInput): string {
  if (!isBrowser()) return ''

  const id = String(
    input.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  )
  removeQhxToast(id)

  const timeout =
    input.timeout === false || input.timeout === 0
      ? 0
      : (input.timeout ?? DEFAULT_TIMEOUT)

  const item: ToastItem = {
    id,
    title: input.title?.trim() || '',
    description: input.description?.trim() || '',
    icon: input.icon || defaultIcon(input.color),
    color: input.color || 'primary',
    timeout,
  }

  const host = ensureHost()
  const el = document.createElement('div')
  el.id = `qhx-toast-${id}`
  el.className = 'qhx-toast-item'
  el.dataset.qhxToastId = id
  el.dataset.color = item.color
  el.dataset.timeout = String(timeout)
  el.style.setProperty('--qhx-toast-timeout', `${Math.max(timeout, 0)}ms`)
  el.setAttribute('role', 'status')

  const row = document.createElement('div')
  row.className = 'qhx-toast-row'

  const iconWrap = document.createElement('div')
  iconWrap.className = 'qhx-toast-icon'
  iconWrap.innerHTML = iconSvg(iconKind(item))

  const body = document.createElement('div')
  body.className = 'qhx-toast-body'
  if (item.title) {
    const title = document.createElement('p')
    title.className = 'qhx-toast-title'
    title.textContent = item.title
    body.appendChild(title)
  }
  if (item.description) {
    const desc = document.createElement('p')
    desc.className = 'qhx-toast-desc'
    desc.textContent = item.description
    body.appendChild(desc)
  }

  const close = document.createElement('button')
  close.type = 'button'
  close.className = 'qhx-toast-close'
  close.setAttribute('aria-label', '关闭')
  close.innerHTML =
    '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>'
  close.addEventListener('click', () => removeQhxToast(id))

  row.append(iconWrap, body, close)

  const bar = document.createElement('div')
  bar.className = 'qhx-toast-bar'

  el.append(row, bar)
  host.appendChild(el)

  while (host.children.length > MAX_TOASTS) {
    const oldest = host.firstElementChild as HTMLElement | null
    const oldestId = oldest?.dataset.qhxToastId
    if (oldestId) removeQhxToast(oldestId)
    else oldest?.remove()
  }

  if (timeout > 0) {
    timers.set(
      id,
      setTimeout(() => {
        removeQhxToast(id)
      }, timeout)
    )
  }

  return id
}

export function showToast(
  titleOrOptions: string | ToastInput,
  options?: Omit<ToastInput, 'title'>
): string {
  if (typeof titleOrOptions === 'string') {
    return addQhxToast({ title: titleOrOptions, ...options })
  }
  return addQhxToast(titleOrOptions)
}
