export type AssetType = 'Domestic Stock' | 'International Stock' | 'Cash' | 'Private' | 'Real Estate';
export type TaxStatus = 'Pre-Tax' | 'Post-Tax' | 'Locked';

export interface Asset {
  id: string;
  account: string;
  ticker: string;
  type: AssetType;
  taxStatus: TaxStatus;
  qty: number;
  beta: number;
  price?: number;
  total: number;
  isEnabled: boolean;
}

export interface SimulationParams {
  monthlySpend: number;
  monthlySavings: number;
  retirementYears: number;
  expectedReturn: number;
  realEstateReturn: number;
  volatility: number;
  withdrawalRate: number;
  inflationRate: number;
  taxRate: number;
  marketCrash: number;
  careerAdjustment: number;
}

export interface SimulationPath {
  id: number;
  data: { year: number; value: number }[];
}
