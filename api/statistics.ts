import type { BaseResponse } from '@/types/api';

// 模拟的分布数据接口
export interface DistributedMapData {
  ip_location: string;
  COUNT: number;
}

export async function getDistributedMaps(): Promise<BaseResponse<DistributedMapData[]>> {
  // 模拟数据
  const mockData: DistributedMapData[] = [
    { ip_location: '广东', COUNT: 150 },
    { ip_location: '北京', COUNT: 120 },
    { ip_location: '上海', COUNT: 110 },
    { ip_location: '浙江', COUNT: 100 },
    { ip_location: '江苏', COUNT: 90 },
    { ip_location: '四川', COUNT: 80 },
    { ip_location: '湖北', COUNT: 70 },
    { ip_location: '福建', COUNT: 60 },
    { ip_location: '山东', COUNT: 50 },
    { ip_location: '湖南', COUNT: 40 },
    { ip_location: '河南', COUNT: 30 },
    { ip_location: '安徽', COUNT: 20 },
    { ip_location: '陕西', COUNT: 15 },
    { ip_location: '重庆', COUNT: 15 },
    { ip_location: '辽宁', COUNT: 10 },
    { ip_location: '天津', COUNT: 10 },
    { ip_location: '云南', COUNT: 10 },
    { ip_location: '广西', COUNT: 10 },
    { ip_location: '山西', COUNT: 5 },
    { ip_location: '黑龙江', COUNT: 5 },
    { ip_location: '吉林', COUNT: 5 },
    { ip_location: '河北', COUNT: 5 },
    { ip_location: '江西', COUNT: 5 },
    { ip_location: '贵州', COUNT: 5 },
    { ip_location: '内蒙古', COUNT: 2 },
    { ip_location: '甘肃', COUNT: 2 },
    { ip_location: '海南', COUNT: 2 },
    { ip_location: '宁夏', COUNT: 1 },
    { ip_location: '青海', COUNT: 1 },
    { ip_location: '新疆', COUNT: 1 },
    { ip_location: '西藏', COUNT: 1 },
  ];

  // 模拟异步请求
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        code: 200,
        message: 'success',
        data: mockData,
      });
    }, 500);
  });
  // 实际请求应该是：
  // const response = await use$Get<BaseResponse<DistributedMapData[]>>('/statistics/distributedMaps');
  // return response.data;
}
