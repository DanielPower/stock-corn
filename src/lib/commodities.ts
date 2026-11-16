export const Commodities = {
  Corn: 1,
  CropCoins: 2,
  Tnt: 3,
  Maria: 4,
  Chips: 5,
} as const;

export type CommodityName = keyof typeof Commodities;
export type Commodity = (typeof Commodities)[CommodityName];

const CommodityEnumReverse = Object.fromEntries(
  Object.entries(Commodities).map(([key, value]) => [value, key]),
) as { [K in Commodity]: CommodityName };

export function getCommodityName(value: Commodity): CommodityName {
  return CommodityEnumReverse[value];
}

export function getCommodityValue(key: CommodityName): Commodity {
  return Commodities[key];
}
