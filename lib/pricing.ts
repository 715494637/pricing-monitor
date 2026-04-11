import { PricingAPIResponse, PriceDisplay, PriceChange } from './types';

const API_URL = 'https://new2.882111.xyz/api/pricing';
const PRICE_MULTIPLIER = 2; // model_ratio * 2 = ¥/M tokens

export async function fetchPricing(): Promise<PricingAPIResponse> {
  const res = await fetch(API_URL, {
    headers: {
      'accept': 'application/json',
      'cache-control': 'no-store',
      'new-api-user': '1',
    },
    next: { revalidate: 0 },
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export function transformPricing(data: PricingAPIResponse): PriceDisplay[] {
  const vendorMap = new Map(data.vendors.map(v => [v.id, v]));

  return data.data
    .map(m => {
      const vendor = vendorMap.get(m.vendor_id);
      const inputPrice = +(m.model_ratio * PRICE_MULTIPLIER).toFixed(4);
      const outputPrice = +(m.model_ratio * m.completion_ratio * PRICE_MULTIPLIER).toFixed(4);

      return {
        modelName: m.model_name,
        vendorName: vendor?.name || 'Unknown',
        vendorIcon: m.icon || vendor?.icon || '',
        inputPrice,
        outputPrice,
        modelRatio: m.model_ratio,
        completionRatio: m.completion_ratio,
        endpoints: m.supported_endpoint_types,
      };
    })
    .sort((a, b) => a.vendorName.localeCompare(b.vendorName) || a.modelName.localeCompare(b.modelName));
}

export function diffPricing(oldPrices: PriceDisplay[], newPrices: PriceDisplay[]): PriceChange[] {
  const changes: PriceChange[] = [];
  const now = new Date().toISOString();
  const oldMap = new Map(oldPrices.map(p => [p.modelName, p]));
  const newMap = new Map(newPrices.map(p => [p.modelName, p]));

  for (const [name, np] of newMap) {
    const op = oldMap.get(name);
    if (!op) {
      changes.push({
        modelName: name,
        vendorName: np.vendorName,
        type: 'new',
        inputPrice: np.inputPrice,
        outputPrice: np.outputPrice,
        timestamp: now,
      });
      continue;
    }
    if (op.inputPrice !== np.inputPrice || op.outputPrice !== np.outputPrice) {
      changes.push({
        modelName: name,
        vendorName: np.vendorName,
        type: 'price_change',
        oldInput: op.inputPrice,
        newInput: np.inputPrice,
        oldOutput: op.outputPrice,
        newOutput: np.outputPrice,
        timestamp: now,
      });
    }
  }

  for (const [name, op] of oldMap) {
    if (!newMap.has(name)) {
      changes.push({
        modelName: name,
        vendorName: op.vendorName,
        type: 'removed',
        inputPrice: op.inputPrice,
        outputPrice: op.outputPrice,
        timestamp: now,
      });
    }
  }

  return changes;
}
