import { Asset, SimulationPath } from '../types';

export interface MonteCarloResults {
  paths: SimulationPath[];
  percentiles: {
    p10: { year: number; value: number }[];
    p50: { year: number; value: number }[];
    p90: { year: number; value: number }[];
  };
}

/**
 * Runs a Monte Carlo simulation using Geometric Brownian Motion.
 */
export function runMonteCarlo(
  currentNW: number,
  years: number,
  mu: number, // Expected return (annual)
  sigma: number, // Volatility (annual)
  monthlySavings: number = 0,
  inflationRate: number = 0.02,
  marketCrash: number = 0,
  careerAdjustment: number = 0,
  numSims: number = 100
): MonteCarloResults {
  const allPaths: number[][] = []; // [simIndex][yearIndex]
  const monthlyMu = (mu - inflationRate) / 12;
  const monthlySigma = sigma / Math.sqrt(12);
  const adjustedMonthlySavings = monthlySavings * (1 + careerAdjustment);

  for (let i = 0; i < numSims; i++) {
    const path: number[] = [currentNW];
    let currentVal = currentNW;
    const crashYear = Math.floor(Math.random() * years);

    for (let y = 1; y <= years; y++) {
      if (y === crashYear && marketCrash > 0) {
        currentVal = currentVal * (1 - marketCrash);
      }
      for (let m = 0; m < 12; m++) {
        const z = normalRandom();
        // Monthly growth using GBM: exp((mu - 0.5*sigma^2) + sigma*z)
        const growth = Math.exp((monthlyMu - 0.5 * Math.pow(monthlySigma, 2)) + monthlySigma * z);
        currentVal = currentVal * growth + adjustedMonthlySavings;
      }
      // Ensure wealth doesn't go negative (though unlikely with GBM)
      currentVal = Math.max(0, currentVal);
      path.push(currentVal);
    }
    allPaths.push(path);
  }

  // Calculate percentiles
  const p10: { year: number; value: number }[] = [];
  const p50: { year: number; value: number }[] = [];
  const p90: { year: number; value: number }[] = [];

  for (let y = 0; y <= years; y++) {
    const valuesAtYear = allPaths.map(p => p[y]).sort((a, b) => a - b);
    p10.push({ year: y, value: valuesAtYear[Math.floor(numSims * 0.10)] });
    p50.push({ year: y, value: valuesAtYear[Math.floor(numSims * 0.50)] });
    p90.push({ year: y, value: valuesAtYear[Math.floor(numSims * 0.90)] });
  }

  const paths: SimulationPath[] = allPaths.slice(0, 20).map((p, i) => ({
    id: i,
    data: p.map((val, y) => ({ year: y, value: val }))
  }));

  return {
    paths,
    percentiles: { p10, p50, p90 }
  };
}

export function calculateFIYear(
  currentNW: number,
  monthlySpend: number,
  monthlySavings: number,
  expectedReturn: number,
  withdrawalRate: number,
  inflationRate: number = 0.02,
  careerAdjustment: number = 0
): number | null {
  const targetNW = (monthlySpend * 12) / withdrawalRate;
  if (currentNW >= targetNW) return 0;

  let currentVal = currentNW;
  // Real return = Nominal return - Inflation
  const realReturn = expectedReturn - inflationRate;
  const monthlyReturn = Math.pow(1 + realReturn, 1/12) - 1;
  const adjustedMonthlySavings = monthlySavings * (1 + careerAdjustment);

  // Simulate up to 100 years
  for (let m = 1; m <= 1200; m++) {
    currentVal = currentVal * (1 + monthlyReturn) + adjustedMonthlySavings;
    if (currentVal >= targetNW) {
      return m / 12;
    }
  }

  return null;
}

/**
 * Box-Muller transform for normal distribution
 */
function normalRandom(): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

export function calculatePortfolioBeta(assets: Asset[]): number {
  const totalWealth = assets.reduce((sum, a) => sum + a.total, 0);
  if (totalWealth === 0) return 0;
  
  return assets.reduce((sum, a) => {
    const weight = a.total / totalWealth;
    return sum + (a.beta * weight);
  }, 0);
}

export function calculateRunway(liquidCash: number, monthlySpend: number): number {
  if (monthlySpend <= 0) return Infinity;
  return liquidCash / monthlySpend;
}

export function parseVal(val: any): number {
  if (typeof val === 'string') {
    return parseFloat(val.replace(/,/g, '')) || 0;
  }
  return Number(val) || 0;
}
