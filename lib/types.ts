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
  inputPrice: number;   // ¥/M tokens
  outputPrice: number;  // ¥/M tokens
  modelRatio: number;
  completionRatio: number;
  endpoints: string[];
}

export interface PriceSnapshot {
  timestamp: string;
  prices: PriceDisplay[];
}

export interface PriceChange {
  modelName: string;
  vendorName: string;
  field: 'input' | 'output' | 'new' | 'removed';
  oldValue?: number;
  newValue?: number;
  timestamp: string;
}
