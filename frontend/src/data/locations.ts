/**
 * 出生地经纬度库（用于精确算上升星座）。
 *
 * 国内：34 省级行政区，每省 5-10 个主要城市
 * 国外：30+ 国家，每国 2-5 个主要城市
 *
 * 经纬度都用城市市中心；上升星座对位置的容差大约 100 km，足够准。
 */

export interface City {
  name: string;
  latitude: number;
  longitude: number;
}

export interface Region {
  name: string;
  cities: City[];
}

// ---------- 国内 ----------

export const CHINA_PROVINCES: Region[] = [
  { name: '北京', cities: [{ name: '北京', latitude: 39.9042, longitude: 116.4074 }] },
  { name: '上海', cities: [{ name: '上海', latitude: 31.2304, longitude: 121.4737 }] },
  { name: '天津', cities: [{ name: '天津', latitude: 39.3434, longitude: 117.3616 }] },
  { name: '重庆', cities: [{ name: '重庆', latitude: 29.5630, longitude: 106.5516 }] },

  { name: '广东', cities: [
    { name: '广州', latitude: 23.1291, longitude: 113.2644 },
    { name: '深圳', latitude: 22.5431, longitude: 114.0579 },
    { name: '东莞', latitude: 23.0207, longitude: 113.7518 },
    { name: '佛山', latitude: 23.0218, longitude: 113.1219 },
    { name: '珠海', latitude: 22.2710, longitude: 113.5767 },
    { name: '中山', latitude: 22.5170, longitude: 113.3927 },
    { name: '汕头', latitude: 23.3540, longitude: 116.6822 },
  ]},
  { name: '江苏', cities: [
    { name: '南京', latitude: 32.0603, longitude: 118.7969 },
    { name: '苏州', latitude: 31.2989, longitude: 120.5853 },
    { name: '无锡', latitude: 31.4912, longitude: 120.3119 },
    { name: '常州', latitude: 31.8108, longitude: 119.9741 },
    { name: '南通', latitude: 31.9802, longitude: 120.8943 },
    { name: '徐州', latitude: 34.2057, longitude: 117.2843 },
    { name: '扬州', latitude: 32.3940, longitude: 119.4124 },
  ]},
  { name: '浙江', cities: [
    { name: '杭州', latitude: 30.2741, longitude: 120.1551 },
    { name: '宁波', latitude: 29.8683, longitude: 121.5440 },
    { name: '温州', latitude: 27.9938, longitude: 120.6991 },
    { name: '绍兴', latitude: 30.0023, longitude: 120.5810 },
    { name: '嘉兴', latitude: 30.7522, longitude: 120.7560 },
    { name: '金华', latitude: 29.0784, longitude: 119.6473 },
  ]},
  { name: '山东', cities: [
    { name: '济南', latitude: 36.6512, longitude: 117.1201 },
    { name: '青岛', latitude: 36.0671, longitude: 120.3826 },
    { name: '烟台', latitude: 37.4638, longitude: 121.4479 },
    { name: '潍坊', latitude: 36.7068, longitude: 119.1619 },
    { name: '威海', latitude: 37.5128, longitude: 122.1207 },
    { name: '淄博', latitude: 36.8131, longitude: 118.0548 },
  ]},
  { name: '四川', cities: [
    { name: '成都', latitude: 30.5728, longitude: 104.0668 },
    { name: '绵阳', latitude: 31.4677, longitude: 104.6796 },
    { name: '宜宾', latitude: 28.7515, longitude: 104.6308 },
    { name: '南充', latitude: 30.8373, longitude: 106.1107 },
    { name: '泸州', latitude: 28.8717, longitude: 105.4426 },
  ]},
  { name: '湖北', cities: [
    { name: '武汉', latitude: 30.5928, longitude: 114.3055 },
    { name: '宜昌', latitude: 30.7264, longitude: 111.2899 },
    { name: '襄阳', latitude: 32.0090, longitude: 112.1226 },
    { name: '荆州', latitude: 30.3346, longitude: 112.2390 },
  ]},
  { name: '湖南', cities: [
    { name: '长沙', latitude: 28.2282, longitude: 112.9388 },
    { name: '株洲', latitude: 27.8274, longitude: 113.1339 },
    { name: '湘潭', latitude: 27.8290, longitude: 112.9444 },
    { name: '衡阳', latitude: 26.9000, longitude: 112.6079 },
    { name: '岳阳', latitude: 29.3573, longitude: 113.1289 },
  ]},
  { name: '河北', cities: [
    { name: '石家庄', latitude: 38.0428, longitude: 114.5149 },
    { name: '唐山', latitude: 39.6306, longitude: 118.1804 },
    { name: '保定', latitude: 38.8742, longitude: 115.4646 },
    { name: '邯郸', latitude: 36.6253, longitude: 114.5390 },
    { name: '秦皇岛', latitude: 39.9354, longitude: 119.6005 },
  ]},
  { name: '河南', cities: [
    { name: '郑州', latitude: 34.7466, longitude: 113.6253 },
    { name: '洛阳', latitude: 34.6197, longitude: 112.4540 },
    { name: '开封', latitude: 34.7975, longitude: 114.3076 },
    { name: '南阳', latitude: 32.9908, longitude: 112.5285 },
    { name: '新乡', latitude: 35.3030, longitude: 113.9268 },
  ]},
  { name: '辽宁', cities: [
    { name: '沈阳', latitude: 41.8057, longitude: 123.4315 },
    { name: '大连', latitude: 38.9140, longitude: 121.6147 },
    { name: '鞍山', latitude: 41.1085, longitude: 122.9954 },
    { name: '抚顺', latitude: 41.8807, longitude: 123.9572 },
  ]},
  { name: '吉林', cities: [
    { name: '长春', latitude: 43.8171, longitude: 125.3235 },
    { name: '吉林', latitude: 43.8378, longitude: 126.5494 },
  ]},
  { name: '黑龙江', cities: [
    { name: '哈尔滨', latitude: 45.8038, longitude: 126.5350 },
    { name: '大庆', latitude: 46.5907, longitude: 125.1039 },
    { name: '齐齐哈尔', latitude: 47.3543, longitude: 123.9180 },
  ]},
  { name: '陕西', cities: [
    { name: '西安', latitude: 34.3416, longitude: 108.9398 },
    { name: '咸阳', latitude: 34.3294, longitude: 108.7080 },
    { name: '宝鸡', latitude: 34.3624, longitude: 107.2371 },
  ]},
  { name: '山西', cities: [
    { name: '太原', latitude: 37.8706, longitude: 112.5489 },
    { name: '大同', latitude: 40.0768, longitude: 113.3001 },
    { name: '运城', latitude: 35.0265, longitude: 110.9988 },
  ]},
  { name: '安徽', cities: [
    { name: '合肥', latitude: 31.8206, longitude: 117.2272 },
    { name: '芜湖', latitude: 31.3526, longitude: 118.4332 },
    { name: '蚌埠', latitude: 32.9166, longitude: 117.3892 },
  ]},
  { name: '福建', cities: [
    { name: '福州', latitude: 26.0745, longitude: 119.2965 },
    { name: '厦门', latitude: 24.4798, longitude: 118.0894 },
    { name: '泉州', latitude: 24.8741, longitude: 118.6757 },
    { name: '漳州', latitude: 24.5108, longitude: 117.6471 },
  ]},
  { name: '江西', cities: [
    { name: '南昌', latitude: 28.6829, longitude: 115.8579 },
    { name: '九江', latitude: 29.7050, longitude: 116.0019 },
    { name: '赣州', latitude: 25.8307, longitude: 114.9347 },
  ]},
  { name: '云南', cities: [
    { name: '昆明', latitude: 25.0389, longitude: 102.7183 },
    { name: '大理', latitude: 25.6065, longitude: 100.2679 },
    { name: '丽江', latitude: 26.8721, longitude: 100.2257 },
  ]},
  { name: '贵州', cities: [
    { name: '贵阳', latitude: 26.6470, longitude: 106.6302 },
    { name: '遵义', latitude: 27.7256, longitude: 106.9275 },
  ]},
  { name: '甘肃', cities: [
    { name: '兰州', latitude: 36.0611, longitude: 103.8343 },
    { name: '天水', latitude: 34.5810, longitude: 105.7249 },
  ]},
  { name: '广西', cities: [
    { name: '南宁', latitude: 22.8170, longitude: 108.3669 },
    { name: '桂林', latitude: 25.2342, longitude: 110.1796 },
    { name: '柳州', latitude: 24.3267, longitude: 109.4280 },
    { name: '北海', latitude: 21.4733, longitude: 109.1207 },
  ]},
  { name: '内蒙古', cities: [
    { name: '呼和浩特', latitude: 40.8426, longitude: 111.7491 },
    { name: '包头', latitude: 40.6580, longitude: 109.8403 },
    { name: '鄂尔多斯', latitude: 39.6086, longitude: 109.7811 },
  ]},
  { name: '宁夏', cities: [
    { name: '银川', latitude: 38.4872, longitude: 106.2309 },
  ]},
  { name: '青海', cities: [
    { name: '西宁', latitude: 36.6171, longitude: 101.7782 },
  ]},
  { name: '海南', cities: [
    { name: '海口', latitude: 20.0440, longitude: 110.1989 },
    { name: '三亚', latitude: 18.2479, longitude: 109.5146 },
  ]},
  { name: '新疆', cities: [
    { name: '乌鲁木齐', latitude: 43.8256, longitude: 87.6168 },
    { name: '喀什', latitude: 39.4677, longitude: 75.9938 },
  ]},
  { name: '西藏', cities: [
    { name: '拉萨', latitude: 29.6500, longitude: 91.1409 },
  ]},
  { name: '香港', cities: [{ name: '香港', latitude: 22.3193, longitude: 114.1694 }] },
  { name: '澳门', cities: [{ name: '澳门', latitude: 22.1987, longitude: 113.5439 }] },
  { name: '台湾', cities: [
    { name: '台北', latitude: 25.0330, longitude: 121.5654 },
    { name: '高雄', latitude: 22.6273, longitude: 120.3014 },
    { name: '台中', latitude: 24.1477, longitude: 120.6736 },
  ]},
];

// ---------- 国外 ----------

export const WORLD_COUNTRIES: Region[] = [
  { name: '日本', cities: [
    { name: '东京', latitude: 35.6762, longitude: 139.6503 },
    { name: '大阪', latitude: 34.6937, longitude: 135.5023 },
    { name: '京都', latitude: 35.0116, longitude: 135.7681 },
    { name: '横滨', latitude: 35.4437, longitude: 139.6380 },
    { name: '札幌', latitude: 43.0642, longitude: 141.3469 },
  ]},
  { name: '韩国', cities: [
    { name: '首尔', latitude: 37.5665, longitude: 126.9780 },
    { name: '釜山', latitude: 35.1796, longitude: 129.0756 },
    { name: '济州', latitude: 33.4996, longitude: 126.5312 },
  ]},
  { name: '美国', cities: [
    { name: '纽约', latitude: 40.7128, longitude: -74.0060 },
    { name: '洛杉矶', latitude: 34.0522, longitude: -118.2437 },
    { name: '旧金山', latitude: 37.7749, longitude: -122.4194 },
    { name: '芝加哥', latitude: 41.8781, longitude: -87.6298 },
    { name: '波士顿', latitude: 42.3601, longitude: -71.0589 },
    { name: '西雅图', latitude: 47.6062, longitude: -122.3321 },
    { name: '华盛顿', latitude: 38.9072, longitude: -77.0369 },
    { name: '休斯顿', latitude: 29.7604, longitude: -95.3698 },
  ]},
  { name: '加拿大', cities: [
    { name: '多伦多', latitude: 43.6532, longitude: -79.3832 },
    { name: '温哥华', latitude: 49.2827, longitude: -123.1207 },
    { name: '蒙特利尔', latitude: 45.5017, longitude: -73.5673 },
  ]},
  { name: '英国', cities: [
    { name: '伦敦', latitude: 51.5074, longitude: -0.1278 },
    { name: '曼彻斯特', latitude: 53.4808, longitude: -2.2426 },
    { name: '爱丁堡', latitude: 55.9533, longitude: -3.1883 },
  ]},
  { name: '法国', cities: [
    { name: '巴黎', latitude: 48.8566, longitude: 2.3522 },
    { name: '里昂', latitude: 45.7640, longitude: 4.8357 },
    { name: '马赛', latitude: 43.2965, longitude: 5.3698 },
  ]},
  { name: '德国', cities: [
    { name: '柏林', latitude: 52.5200, longitude: 13.4050 },
    { name: '慕尼黑', latitude: 48.1351, longitude: 11.5820 },
    { name: '法兰克福', latitude: 50.1109, longitude: 8.6821 },
  ]},
  { name: '意大利', cities: [
    { name: '罗马', latitude: 41.9028, longitude: 12.4964 },
    { name: '米兰', latitude: 45.4642, longitude: 9.1900 },
    { name: '佛罗伦萨', latitude: 43.7696, longitude: 11.2558 },
  ]},
  { name: '西班牙', cities: [
    { name: '马德里', latitude: 40.4168, longitude: -3.7038 },
    { name: '巴塞罗那', latitude: 41.3851, longitude: 2.1734 },
  ]},
  { name: '荷兰', cities: [
    { name: '阿姆斯特丹', latitude: 52.3676, longitude: 4.9041 },
  ]},
  { name: '澳大利亚', cities: [
    { name: '悉尼', latitude: -33.8688, longitude: 151.2093 },
    { name: '墨尔本', latitude: -37.8136, longitude: 144.9631 },
    { name: '布里斯班', latitude: -27.4698, longitude: 153.0251 },
  ]},
  { name: '新西兰', cities: [
    { name: '奥克兰', latitude: -36.8485, longitude: 174.7633 },
  ]},
  { name: '新加坡', cities: [{ name: '新加坡', latitude: 1.3521, longitude: 103.8198 }] },
  { name: '马来西亚', cities: [
    { name: '吉隆坡', latitude: 3.1390, longitude: 101.6869 },
    { name: '槟城', latitude: 5.4164, longitude: 100.3327 },
  ]},
  { name: '泰国', cities: [
    { name: '曼谷', latitude: 13.7563, longitude: 100.5018 },
    { name: '清迈', latitude: 18.7883, longitude: 98.9853 },
    { name: '普吉', latitude: 7.8804, longitude: 98.3923 },
  ]},
  { name: '印度尼西亚', cities: [
    { name: '雅加达', latitude: -6.2088, longitude: 106.8456 },
    { name: '巴厘', latitude: -8.4095, longitude: 115.1889 },
  ]},
  { name: '越南', cities: [
    { name: '河内', latitude: 21.0285, longitude: 105.8542 },
    { name: '胡志明市', latitude: 10.8231, longitude: 106.6297 },
  ]},
  { name: '菲律宾', cities: [{ name: '马尼拉', latitude: 14.5995, longitude: 120.9842 }] },
  { name: '俄罗斯', cities: [
    { name: '莫斯科', latitude: 55.7558, longitude: 37.6173 },
    { name: '圣彼得堡', latitude: 59.9311, longitude: 30.3609 },
  ]},
  { name: '阿联酋', cities: [
    { name: '迪拜', latitude: 25.2048, longitude: 55.2708 },
    { name: '阿布扎比', latitude: 24.4539, longitude: 54.3773 },
  ]},
  { name: '土耳其', cities: [
    { name: '伊斯坦布尔', latitude: 41.0082, longitude: 28.9784 },
  ]},
  { name: '埃及', cities: [{ name: '开罗', latitude: 30.0444, longitude: 31.2357 }] },
  { name: '南非', cities: [
    { name: '开普敦', latitude: -33.9249, longitude: 18.4241 },
    { name: '约翰内斯堡', latitude: -26.2041, longitude: 28.0473 },
  ]},
  { name: '巴西', cities: [
    { name: '里约热内卢', latitude: -22.9068, longitude: -43.1729 },
    { name: '圣保罗', latitude: -23.5505, longitude: -46.6333 },
  ]},
  { name: '墨西哥', cities: [{ name: '墨西哥城', latitude: 19.4326, longitude: -99.1332 }] },
  { name: '阿根廷', cities: [{ name: '布宜诺斯艾利斯', latitude: -34.6037, longitude: -58.3816 }] },
  { name: '印度', cities: [
    { name: '新德里', latitude: 28.6139, longitude: 77.2090 },
    { name: '孟买', latitude: 19.0760, longitude: 72.8777 },
    { name: '班加罗尔', latitude: 12.9716, longitude: 77.5946 },
  ]},
];
