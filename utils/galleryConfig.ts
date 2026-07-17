import type { GalleryConfig, GalleryShopMarker } from '@/types/gallery'

/** 默认展馆 ID（/exhibition/gallery 会重定向到此 ID） */
export const DEFAULT_GALLERY_ID = '1'

const fallbackShops: GalleryShopMarker[] = [
  {
    shop_id: 27,
    shop_name: '示例店铺 A',
    shop_logo: 'static/plan_cover/default.jpg',
    position: [-6, -2],
    objects: [
      {
        type: 'splat',
        library_id: 805,
        url: 'sence/point_cloud/rad/3988/xrcm.compressed-lod.rad',
        title: '暗香 粉蓝色',
        position: [0, 2, 2],
        scale: [0.5, 0.5, 0.5],
        rotation: [0, -1.8, 0],
        options: { paged: true, maxSplats: 50000, maxSh: 2 }
      },
      {
        type: 'splat',
        library_id: 805,
        url: 'sence/point_cloud/9ca3ef945aef438ecd141142430ce36a.spz',
        title: '暗香 粉蓝色',
        position: [0, 2, -2],
        scale: [0.5, 0.5, 0.5],
        rotation: [0, -1.57, 0],
        options: { maxSplats: 50000, maxSh: 2 }
      }
    ]
  },
  {
    shop_id: 0,
    shop_name: '示例店铺 B',
    shop_logo: 'static/plan_cover/default.jpg',
    position: [6, -4]
  },
  {
    shop_id: 0,
    shop_name: '示例店铺 C',
    shop_logo: 'static/plan_cover/default.jpg',
    position: [-6, 4]
  }
]

/**
 * 本地 fallback 配置（OSS 未就绪或 id=1 请求失败时使用）
 * 线上配置请上传至：{BASE_IMG}ssr/gallery/{id}.json
 */
export const defaultGalleryConfig: GalleryConfig = {
  mapSize: { width: 24, depth: 20 },
  moveSpeed: 5,
  playerStart: [0, 6],
  interactDistance: 2,
  playerRadius: 0.4,
  walls: [
    { position: [0, -9.5], size: [24, 0.5], height: 1.2 },
    { position: [0, 9.5], size: [24, 0.5], height: 1.2 },
    { position: [-11.5, 0], size: [0.5, 20], height: 1.2 },
    { position: [11.5, 0], size: [0.5, 20], height: 1.2 },
    { position: [-4, 0], size: [0.4, 8], height: 1.2 },
    { position: [4, -3], size: [0.4, 6], height: 1.2 },
    { position: [8, 4], size: [6, 0.4], height: 1.2 }
  ],
  exhibits: [],
  shops: fallbackShops
}
