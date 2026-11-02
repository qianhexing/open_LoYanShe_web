import {
  addQhxToast,
  clearQhxToasts,
  removeQhxToast,
} from '@/utils/qhxToast'

/**
 * Qhx Toast。业务里请用这个或 showToast，不要再用 Nuxt UI 的 useToast。
 */
export function useQhxToast() {
  return {
    add: addQhxToast,
    remove: removeQhxToast,
    clear: clearQhxToasts,
  }
}
