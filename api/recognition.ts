import { use$Post } from '@/composables/httpCore';

export interface RecognizeResult {
  scene_id: number;
  confidence: number;
}

/**
 * 模拟识图接口
 * 实际项目中：上传 base64 或 File，服务端匹配后返回 scene_id
 */
export async function recognizeImage(imageBlob: Blob): Promise<RecognizeResult> {
  // 模拟网络延迟
  await new Promise(resolve => setTimeout(resolve, 800));
  
  // 强制返回 scene_id = 1，走现有逻辑
  // 这里的 scene_id = 1 对应 utils/ar/config.ts 中的配置
  // 同时也应该对应后端 api/scene.ts 获取场景数据的 ID
  return {
    scene_id: 1,
    confidence: 0.98
  };
}
