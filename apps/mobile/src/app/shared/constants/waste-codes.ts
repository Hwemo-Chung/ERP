/**
 * Waste Pickup Codes
 * Based on PRD FR-05 and API_SPEC waste/codes endpoint
 *
 * P01~P21: Standard waste appliance codes for ECOAS reporting
 */

export interface WasteCode {
  code: string;
  name: string;
  category: WasteCategory;
}

export enum WasteCategory {
  REFRIGERATOR = 'REFRIGERATOR',
  WASHER = 'WASHER',
  AIR_CONDITIONER = 'AIR_CONDITIONER',
  TV = 'TV',
  SMALL_APPLIANCE = 'SMALL_APPLIANCE',
  OTHER = 'OTHER',
}

export const WASTE_CATEGORY_LABELS: Record<WasteCategory, string> = {
  [WasteCategory.REFRIGERATOR]: '냉장고류',
  [WasteCategory.WASHER]: '세탁기류',
  [WasteCategory.AIR_CONDITIONER]: '에어컨류',
  [WasteCategory.TV]: 'TV류',
  [WasteCategory.SMALL_APPLIANCE]: '소형가전',
  [WasteCategory.OTHER]: '기타',
};

/**
 * Complete list of waste codes per PRD specification
 * Format: Pxx - appliance type
 */
export const WASTE_CODES: WasteCode[] = [
  // Refrigerator category (P01-P04)
  { code: 'P01', name: '냉장고 (300L 미만)', category: WasteCategory.REFRIGERATOR },
  { code: 'P02', name: '냉장고 (300L 이상)', category: WasteCategory.REFRIGERATOR },
  { code: 'P03', name: '김치냉장고', category: WasteCategory.REFRIGERATOR },
  { code: 'P04', name: '냉동고', category: WasteCategory.REFRIGERATOR },

  // Washer category (P05-P07)
  { code: 'P05', name: '세탁기 (드럼)', category: WasteCategory.WASHER },
  { code: 'P06', name: '세탁기 (통돌이)', category: WasteCategory.WASHER },
  { code: 'P07', name: '건조기', category: WasteCategory.WASHER },

  // Air conditioner category (P08-P10)
  { code: 'P08', name: '벽걸이 에어컨', category: WasteCategory.AIR_CONDITIONER },
  { code: 'P09', name: '스탠드 에어컨', category: WasteCategory.AIR_CONDITIONER },
  { code: 'P10', name: '시스템 에어컨 (실내기)', category: WasteCategory.AIR_CONDITIONER },

  // TV category (P11-P13)
  { code: 'P11', name: 'TV (32인치 미만)', category: WasteCategory.TV },
  { code: 'P12', name: 'TV (32인치 이상)', category: WasteCategory.TV },
  { code: 'P13', name: '모니터', category: WasteCategory.TV },

  // Small appliances (P14-P18)
  { code: 'P14', name: '전자레인지', category: WasteCategory.SMALL_APPLIANCE },
  { code: 'P15', name: '식기세척기', category: WasteCategory.SMALL_APPLIANCE },
  { code: 'P16', name: '공기청정기', category: WasteCategory.SMALL_APPLIANCE },
  { code: 'P17', name: '제습기', category: WasteCategory.SMALL_APPLIANCE },
  { code: 'P18', name: '청소기', category: WasteCategory.SMALL_APPLIANCE },

  // Other (P19-P21)
  { code: 'P19', name: '음식물처리기', category: WasteCategory.OTHER },
  { code: 'P20', name: '정수기', category: WasteCategory.OTHER },
  { code: 'P21', name: '기타 가전', category: WasteCategory.OTHER },
];

/**
 * Get waste codes by category
 */
export function getWasteCodesByCategory(category: WasteCategory): WasteCode[] {
  return WASTE_CODES.filter((code) => code.category === category);
}

/**
 * Get waste code by code string
 */
export function getWasteCodeByCode(code: string): WasteCode | undefined {
  return WASTE_CODES.find((w) => w.code === code);
}

/**
 * Validate if a code is valid
 */
export function isValidWasteCode(code: string): boolean {
  return WASTE_CODES.some((w) => w.code === code);
}

/**
 * Get grouped waste codes for select dropdown
 */
export function getGroupedWasteCodes(): Map<WasteCategory, WasteCode[]> {
  const grouped = new Map<WasteCategory, WasteCode[]>();

  for (const category of Object.values(WasteCategory)) {
    grouped.set(category, getWasteCodesByCategory(category));
  }

  return grouped;
}
