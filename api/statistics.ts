import { use$Get } from '@/composables/httpCore'

export interface DistributedMapItem {
  ip_location: string
  COUNT: number
}

export const getDistributedMaps = () => {
  return use$Get<{ code: number, data: DistributedMapItem[] }>('/statistics/distributedMaps')
}
