export interface ModelPricing {
  model_name: string;
  vendor_id: number;
  quota_type: number;
  model_ratio: number;
  model_price: number;
  completion_ratio: number;
  enable_groups: string[];
  supported_endpoint_types: string[];
  icon?: string;
  owner_by?: string;
  pricing_version?: string;
}

export interface Vendor {
  id: number;
  name: string;
  icon?: string;
  description?: string;
}

export interface PricingAPIResponse {
  success: boolean;
  data: ModelPricing[];
  vendors: Vendor[];
  group_ratio: Record<string, number>;
  auto_groups: string[];
}

export interface PriceDisplay {
  modelName: string;
  vendorName: string;
  vendorIcon: string;
  inputPrice: number;
  outputPrice: number;
  modelRatio: number;
  completionRatio: number;
  endpoints: string[];
}

export interface PriceSnapshot {
  timestamp: string;
  prices: PriceDisplay[];
}

/**
 * 变更记录 — 每条记录对应一个模型在一次探测中的变化
 * type: 'price_change' | 'new' | 'removed'
 */
export interface PriceChange {
  modelName: string;
  vendorName: string;
  type: 'price_change' | 'new' | 'removed';
  timestamp: string;
  // price_change: 旧→新
  oldInput?: number;
  newInput?: number;
  oldOutput?: number;
  newOutput?: number;
  // new: 新增模型的价格
  inputPrice?: number;
  outputPrice?: number;
}
