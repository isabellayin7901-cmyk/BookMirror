/**
 * 常用中国城市经纬度，用于精确计算上升星座。
 * 用户也可以选"不知道"跳过上升计算（只显示太阳/月亮）。
 */

export interface City {
  name: string;
  latitude: number;   // 北纬正
  longitude: number;  // 东经正
}

export const CITIES: City[] = [
  { name: '北京', latitude: 39.9042, longitude: 116.4074 },
  { name: '上海', latitude: 31.2304, longitude: 121.4737 },
  { name: '广州', latitude: 23.1291, longitude: 113.2644 },
  { name: '深圳', latitude: 22.5431, longitude: 114.0579 },
  { name: '杭州', latitude: 30.2741, longitude: 120.1551 },
  { name: '成都', latitude: 30.5728, longitude: 104.0668 },
  { name: '重庆', latitude: 29.5630, longitude: 106.5516 },
  { name: '武汉', latitude: 30.5928, longitude: 114.3055 },
  { name: '南京', latitude: 32.0603, longitude: 118.7969 },
  { name: '西安', latitude: 34.3416, longitude: 108.9398 },
  { name: '天津', latitude: 39.3434, longitude: 117.3616 },
  { name: '苏州', latitude: 31.2989, longitude: 120.5853 },
  { name: '青岛', latitude: 36.0671, longitude: 120.3826 },
  { name: '长沙', latitude: 28.2282, longitude: 112.9388 },
  { name: '郑州', latitude: 34.7466, longitude: 113.6253 },
  { name: '沈阳', latitude: 41.8057, longitude: 123.4315 },
  { name: '哈尔滨', latitude: 45.8038, longitude: 126.5350 },
  { name: '昆明', latitude: 25.0389, longitude: 102.7183 },
  { name: '香港', latitude: 22.3193, longitude: 114.1694 },
  { name: '台北', latitude: 25.0330, longitude: 121.5654 },
];
