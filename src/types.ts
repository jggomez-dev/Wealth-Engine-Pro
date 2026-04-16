export type AssetType = 'Domestic Stock' | 'International Stock' | 'Cash' | 'Private' | 'Real Estate' | 'Crypto' | 'Gold' | 'Bonds';
export type TaxStatus = 'Pre-Tax' | 'Post-Tax' | 'Locked' | 'Roth';
export type LiabilityType = 'Mortgage' | 'Student Loan' | 'Credit Card' | 'Auto Loan' | 'Other';

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
  basis?: number;
}

export interface Liability {
  id: string;
  name: string;
  type: LiabilityType;
  balance: number;
  interestRate: number;
  minimumPayment: number;
}

export interface HistoricalNetWorth {
  id: string;
  date: string;
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
}

export interface PropertyConfig {
  id: string;
  name: string;
  purchaseDate: string;
  purchasePrice: number;
  closingCosts: number;
  rehabCosts: number;
  downPaymentPercent: number;
  interestRate: number;
  loanTerm: number;
  extraPrincipalMonthly: number;
  oneTimePrincipal: number;
  oneTimePrincipalYear: number;
  grossRent: number;
  otherIncome: number;
  propertyTaxes: number;
  insurance: number;
  repairsPercent: number;
  vacancyPercent: number;
  capexPercent: number;
  managementPercent: number;
  hoa: number;
  appreciationRate: number;
  rentGrowthRate: number;
  expenseGrowthRate: number;
  currentLoanBalanceOverride?: number;
  linkedAssetId?: string;
  linkedLiabilityId?: string;
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
  aggressiveness: number; // 0: Conservative, 1: Moderate, 2: Aggressive, 3: Super Aggressive
  rebalanceThreshold: number; // Percentage drift to trigger alert (e.g., 5)
  portfolioTargets?: Record<string, number>; // Target percentage for each AssetType
}

export interface SimulationPath {
  id: number;
  data: { year: number; value: number }[];
}
