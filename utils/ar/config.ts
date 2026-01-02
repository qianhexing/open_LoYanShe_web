export interface ARSceneConfig {
  id: number;
  name: string;
  mindUrl: string; // MindAR 编译好的 .mind 文件地址
  targetIndex: number; // .mind 文件中包含多个图时，指定使用哪一张（通常是0）
}

export const AR_SCENE_MAP: Record<number, ARSceneConfig> = {
  1: {
    id: 1,
    name: '示例场景',
    // 使用 MindAR 官方示例的 card.mind
    mindUrl: 'https://lolitalibrary.com/pc/mind/1.mind',
    targetIndex: 0
  },
  // 可以添加更多
};

export const getARConfig = (sceneId: number) => AR_SCENE_MAP[1];
