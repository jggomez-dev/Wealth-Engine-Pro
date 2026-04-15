import React, { useState, useMemo, useEffect } from 'react';
import { Asset, SimulationParams, SimulationPath, Liability, HistoricalNetWorth, PropertyConfig } from './types';
import { runMonteCarlo, calculatePortfolioBeta, calculateRunway, calculateFIYear } from './utils/finance';
import { getPortfolioInsight } from './services/geminiService';
import { formatCurrency, cn } from './lib/utils';
import Sidebar from './components/Sidebar';
import MetricCard from './components/MetricCard';
import PortfolioChart from './components/PortfolioChart';
import AggressivenessCard from './components/AggressivenessCard';
import ProjectionChart from './components/ProjectionChart';
import LedgerTable from './components/LedgerTable';
import LiabilitiesTable from './components/LiabilitiesTable';
import HistoricalChart from './components/HistoricalChart';
import TaxBreakdownChart from './components/TaxBreakdownChart';
import { HealthcareCalculator } from './components/HealthcareCalculator';
import SabbaticalCalculator from './components/SabbaticalCalculator';
import RealEstateCalculator, { RealEstatePropertyData, DEFAULT_PROPERTY } from './components/RealEstateCalculator';
import { Wallet, Timer, TrendingUp, AlertCircle, CheckCircle2, Info, Target, Menu, X as CloseIcon, Languages, BrainCircuit, Send, LogIn, LogOut, Activity, Briefcase, Home } from 'lucide-react';
import { useLanguage } from './lib/LanguageContext';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import { signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { doc, setDoc, collection, onSnapshot, deleteDoc, getDoc, writeBatch } from 'firebase/firestore';

const INITIAL_ASSETS: Asset[] = [
  { id: '1', account: 'IRA 1', ticker: 'VTIAX', type: 'International Stock', taxStatus: 'Pre-Tax', qty: 431.11, beta: 1.0, total: 0, isEnabled: true },
  { id: '2', account: 'IRA 1', ticker: 'VXUS', type: 'International Stock', taxStatus: 'Pre-Tax', qty: 96.04, beta: 1.1, total: 0, isEnabled: true },
  { id: '3', account: 'IRA 1', ticker: 'VEA', type: 'International Stock', taxStatus: 'Pre-Tax', qty: 148.20, beta: 1.0, total: 0, isEnabled: true },
  { id: '4', account: 'Roth IRA 1', ticker: 'VTIAX', type: 'International Stock', taxStatus: 'Post-Tax', qty: 176.09, beta: 1.0, total: 0, isEnabled: true },
  { id: '5', account: '401k', ticker: 'VTSAX', type: 'Domestic Stock', taxStatus: 'Pre-Tax', qty: 536.46, beta: 1.0, total: 0, isEnabled: true },
  { id: '6', account: '401k', ticker: 'VTTSX', type: 'Domestic Stock', taxStatus: 'Pre-Tax', qty: 7.18, beta: 1.0, total: 0, isEnabled: true },
  { id: '7', account: 'IRA 2', ticker: 'FZROX', type: 'Domestic Stock', taxStatus: 'Pre-Tax', qty: 312.72, beta: 1.0, total: 0, isEnabled: true },
  { id: '8', account: 'IRA 1', ticker: 'CASH', type: 'Cash', taxStatus: 'Pre-Tax', qty: 0, beta: 0, total: 48827.24, isEnabled: true },
  { id: '9', account: 'Roth IRA 1', ticker: 'CASH', type: 'Cash', taxStatus: 'Post-Tax', qty: 0, beta: 0, total: 2610.00, isEnabled: true },
  { id: '10', account: 'Brokerage', ticker: 'CASH', type: 'Cash', taxStatus: 'Post-Tax', qty: 0, beta: 0, total: 30110.00, isEnabled: true },
  { id: '11', account: 'Pre-IPO', ticker: 'Company Dtm', type: 'Private', taxStatus: 'Locked', qty: 0, beta: 2.5, total: 88484.00, isEnabled: true },
  { id: '12', account: 'House', ticker: 'Primary Res', type: 'Real Estate', taxStatus: 'Locked', qty: 0, beta: 0.5, total: 205191.00, isEnabled: true },
  { id: '13', account: 'Bank', ticker: 'CASH', type: 'Cash', taxStatus: 'Post-Tax', qty: 0, beta: 0, total: 2552.00, isEnabled: true },
  { id: '14', account: 'Roth IRA 2', ticker: 'CASH', type: 'Cash', taxStatus: 'Post-Tax', qty: 0, beta: 0, total: 24269.01, isEnabled: true },
  { id: '15', account: 'IRA 2', ticker: 'CASH', type: 'Cash', taxStatus: 'Pre-Tax', qty: 0, beta: 0, total: 183.56, isEnabled: true },
];

export default function App() {
  const { t, language, setLanguage } = useLanguage();
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  
  const [assets, setAssets] = useState<Asset[]>(INITIAL_ASSETS);
  const [liabilities, setLiabilities] = useState<Liability[]>([]);
  const [historicalRecords, setHistoricalRecords] = useState<HistoricalNetWorth[]>([]);
  const [realEstateProperties, setRealEstateProperties] = useState<PropertyConfig[]>([
    { id: '1', name: 'Property 1', ...DEFAULT_PROPERTY }
  ]);
  const [currency, setCurrency] = useState<'USD' | 'EUR'>('USD');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'healthcare' | 'sabbatical' | 'realEstate'>('dashboard');
  const [params, setParams] = useState<SimulationParams>({
    monthlySpend: 5000,
    monthlySavings: 2000,
    retirementYears: 20,
    expectedReturn: 0.07,
    realEstateReturn: 0.04,
    volatility: 0.15,
    withdrawalRate: 0.04,
    inflationRate: 0.02,
    taxRate: 0.25,
    marketCrash: 0,
    careerAdjustment: 0,
    aggressiveness: 1, // Default to Moderate
  });
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [coachPrompt, setCoachPrompt] = useState('');
  const [coachResponse, setCoachResponse] = useState('');
  const [isCoaching, setIsCoaching] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const askCoach = async () => {
    if (!coachPrompt.trim()) return;
    setIsCoaching(true);
    try {
      const portfolioData = JSON.stringify(activeAssets);
      const response = await getPortfolioInsight(portfolioData, coachPrompt);
      setCoachResponse(response || "Sorry, I couldn't generate an insight right now.");
    } catch (e) {
      console.error(e);
      setCoachResponse("Error getting insight.");
    } finally {
      setIsCoaching(false);
    }
  };

  // Fetch Live Prices
  const fetchPrices = async () => {
    setIsSyncing(true);
    const tickers = assets
      .filter(a => a.qty > 0 && a.ticker !== 'CASH')
      .map(a => a.ticker)
      .join(',');
    
    if (!tickers) {
      setIsSyncing(false);
      return;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

      const response = await fetch(`/api/prices?tickers=${encodeURIComponent(tickers)}`, { signal: controller.signal });
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Sync failed: ${response.status} ${response.statusText} - ${errorText}`);
        throw new Error(`Sync failed: ${response.statusText}`);
      }
      
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await response.text();
        console.error(`Expected JSON but got ${contentType}:`, text.substring(0, 100));
        throw new Error("Received non-JSON response from server");
      }
      
      const priceMap = await response.json();
      
      setAssets(prev => prev.map(asset => {
        if (priceMap[asset.ticker]) {
          const price = priceMap[asset.ticker];
          return { ...asset, price, total: asset.qty * price };
        }
        return asset;
      }));
      setLastSync(new Date());
    } catch (error) {
      console.error("Failed to sync prices, using fallback:", error);
      // Fallback to some reasonable defaults if API fails
      const FALLBACK: Record<string, number> = { VTIAX: 34.12, VXUS: 63.45, VEA: 52.18, VTSAX: 128.89, VTTSX: 27.34, FZROX: 19.56 };
      setAssets(prev => prev.map(asset => {
        if (FALLBACK[asset.ticker] && asset.total === 0) {
          const price = FALLBACK[asset.ticker];
          return { ...asset, price, total: asset.qty * price };
        }
        return asset;
      }));
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const res = await fetch('/api/health');
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const data = await res.json();
          console.log('Server health check:', data);
        } else {
          console.log('Server health check returned non-JSON response');
        }
      } catch (e) {
        console.error('Server health check failed:', e);
      }
    };
    checkHealth();
    fetchPrices();
    const interval = setInterval(fetchPrices, 3600000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setIsSidebarOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Firebase Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  // Firebase Data Sync
  useEffect(() => {
    if (!isAuthReady) return;

    if (user) {
      // Listen to User Profile (Settings)
      const unsubProfile = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
        if (docSnap.exists() && docSnap.data().settings) {
          setParams(docSnap.data().settings);
        }
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
      });

      // Listen to Assets
      const unsubAssets = onSnapshot(collection(db, 'users', user.uid, 'assets'), (snapshot) => {
        if (!snapshot.empty) {
          const loadedAssets = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Asset));
          setAssets(loadedAssets);
        }
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/assets`);
      });

      // Listen to Liabilities
      const unsubLiabilities = onSnapshot(collection(db, 'users', user.uid, 'liabilities'), (snapshot) => {
        if (!snapshot.empty) {
          const loadedLiabilities = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Liability));
          setLiabilities(loadedLiabilities);
        } else {
          setLiabilities([]);
        }
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/liabilities`);
      });

      // Listen to Historical Net Worth
      const unsubHistorical = onSnapshot(collection(db, 'users', user.uid, 'historicalNetWorth'), (snapshot) => {
        if (!snapshot.empty) {
          const loadedRecords = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as HistoricalNetWorth));
          setHistoricalRecords(loadedRecords);
        } else {
          setHistoricalRecords([]);
        }
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/historicalNetWorth`);
      });

      // Listen to Real Estate Properties
      const unsubRealEstate = onSnapshot(collection(db, 'users', user.uid, 'realEstate'), (snapshot) => {
        if (!snapshot.empty) {
          const loaded = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PropertyConfig));
          setRealEstateProperties(loaded);
        } else {
          setRealEstateProperties([]);
        }
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/realEstate`);
      });

      return () => {
        unsubProfile();
        unsubAssets();
        unsubLiabilities();
        unsubHistorical();
        unsubRealEstate();
      };
    } else {
      // Reset to defaults if logged out
      setAssets(INITIAL_ASSETS);
      setLiabilities([]);
      setHistoricalRecords([]);
      setRealEstateProperties([{ id: '1', name: 'Property 1', ...DEFAULT_PROPERTY }]);
    }
  }, [user, isAuthReady]);

  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({
        prompt: 'select_account'
      });
      const result = await signInWithPopup(auth, provider);
      
      // Check if user profile exists, if not, create it with current local state
      const userDoc = await getDoc(doc(db, 'users', result.user.uid));
      if (!userDoc.exists()) {
        await setDoc(doc(db, 'users', result.user.uid), {
          uid: result.user.uid,
          email: result.user.email,
          settings: params
        });
        
        // Batch write initial assets
        const batch = writeBatch(db);
        assets.forEach(asset => {
          const assetRef = doc(db, 'users', result.user.uid, 'assets', asset.id);
          batch.set(assetRef, { ...asset, userId: result.user.uid });
        });
        await batch.commit();
      }
    } catch (error: any) {
      console.error("Login failed:", error);
      if (error.code === 'auth/popup-closed-by-user') {
        setErrorMessage("The login popup was closed before completing. Please try again and keep the window open until login finishes.");
      } else if (error.code === 'auth/popup-blocked') {
        setErrorMessage("The login popup was blocked by your browser. Please allow popups for this site and try again.");
      } else if (error.code === 'auth/unauthorized-domain') {
        setErrorMessage("This domain is not authorized for Firebase Authentication. Please add it to the Authorized Domains in your Firebase Console.");
      } else {
        setErrorMessage(`Login failed: ${error.message}`);
      }
    }
  };

  const handleLogout = () => {
    signOut(auth);
  };

  const updateParams = (newParams: SimulationParams) => {
    setParams(newParams);
    if (user) {
      setDoc(doc(db, 'users', user.uid), { settings: newParams }, { merge: true }).catch(e => handleFirestoreError(e, OperationType.UPDATE, `users/${user.uid}`));
    }
  };

  const updateAsset = (id: string, updates: Partial<Asset>) => {
    setAssets(prev => prev.map(asset => {
      if (asset.id === id) {
        const updated = { ...asset, ...updates };
        if (updated.price && updated.qty !== undefined) {
          updated.total = updated.qty * updated.price;
        }
        if (user) {
          setDoc(doc(db, 'users', user.uid, 'assets', id), { ...updated, userId: user.uid }, { merge: true }).catch(e => handleFirestoreError(e, OperationType.UPDATE, `users/${user.uid}/assets/${id}`));
        }
        return updated;
      }
      return asset;
    }));
  };

  const addAsset = (asset: Omit<Asset, 'id'>) => {
    const id = Math.random().toString(36).substr(2, 9);
    const newAsset: Asset = { ...asset, id };
    setAssets(prev => [...prev, newAsset]);
    if (user) {
      setDoc(doc(db, 'users', user.uid, 'assets', id), { ...newAsset, userId: user.uid }).catch(e => handleFirestoreError(e, OperationType.CREATE, `users/${user.uid}/assets/${id}`));
    }
    return id;
  };

  const deleteAsset = (id: string) => {
    setAssets(prev => prev.filter(a => a.id !== id));
    if (user) {
      deleteDoc(doc(db, 'users', user.uid, 'assets', id)).catch(e => handleFirestoreError(e, OperationType.DELETE, `users/${user.uid}/assets/${id}`));
    }
  };

  const updateLiability = (id: string, updates: Partial<Liability>) => {
    setLiabilities(prev => prev.map(liability => {
      if (liability.id === id) {
        const updated = { ...liability, ...updates };
        if (user) {
          setDoc(doc(db, 'users', user.uid, 'liabilities', id), { ...updated, userId: user.uid }, { merge: true }).catch(e => handleFirestoreError(e, OperationType.UPDATE, `users/${user.uid}/liabilities/${id}`));
        }
        return updated;
      }
      return liability;
    }));
  };

  const addLiability = (liability: Omit<Liability, 'id'>) => {
    const id = Math.random().toString(36).substr(2, 9);
    const newLiability: Liability = { ...liability, id };
    setLiabilities(prev => [...prev, newLiability]);
    if (user) {
      setDoc(doc(db, 'users', user.uid, 'liabilities', id), { ...newLiability, userId: user.uid }).catch(e => handleFirestoreError(e, OperationType.CREATE, `users/${user.uid}/liabilities/${id}`));
    }
    return id;
  };

  const deleteLiability = (id: string) => {
    setLiabilities(prev => prev.filter(l => l.id !== id));
    if (user) {
      deleteDoc(doc(db, 'users', user.uid, 'liabilities', id)).catch(e => handleFirestoreError(e, OperationType.DELETE, `users/${user.uid}/liabilities/${id}`));
    }
  };

  const handleSavePropertyToLedger = (propertyId: string, propertyData: RealEstatePropertyData) => {
    const property = realEstateProperties.find(p => p.id === propertyId);
    if (!property) return;

    let assetId = property.linkedAssetId;
    let liabilityId = property.linkedLiabilityId;
    let needsPropertyUpdate = false;

    if (assetId && assets.some(a => a.id === assetId)) {
      updateAsset(assetId, {
        account: propertyData.name,
        total: propertyData.value,
      });
    } else {
      assetId = addAsset({
        account: propertyData.name,
        ticker: 'Real Estate',
        type: 'Real Estate',
        taxStatus: 'Locked',
        qty: 1,
        beta: 0.5,
        total: propertyData.value,
        isEnabled: true
      });
      needsPropertyUpdate = true;
    }

    if (propertyData.loanBalance > 0) {
      if (liabilityId && liabilities.some(l => l.id === liabilityId)) {
        updateLiability(liabilityId, {
          name: `${propertyData.name} Mortgage`,
          balance: propertyData.loanBalance,
          interestRate: propertyData.interestRate,
          minimumPayment: propertyData.mortgagePayment
        });
      } else {
        liabilityId = addLiability({
          name: `${propertyData.name} Mortgage`,
          type: 'Mortgage',
          balance: propertyData.loanBalance,
          interestRate: propertyData.interestRate,
          minimumPayment: propertyData.mortgagePayment
        });
        needsPropertyUpdate = true;
      }
    } else if (liabilityId) {
      deleteLiability(liabilityId);
      liabilityId = undefined;
      needsPropertyUpdate = true;
    }

    if (needsPropertyUpdate) {
      const updates = { linkedAssetId: assetId, linkedLiabilityId: liabilityId };
      setRealEstateProperties(prev => {
        const newProps = prev.map(p => p.id === propertyId ? { ...p, ...updates } : p);
        if (user) {
          const updatedProp = newProps.find(p => p.id === propertyId);
          if (updatedProp) {
            setDoc(doc(db, 'users', user.uid, 'realEstate', propertyId), { ...updatedProp, userId: user.uid }, { merge: true }).catch(e => handleFirestoreError(e, OperationType.UPDATE, `users/${user.uid}/realEstate/${propertyId}`));
          }
        }
        return newProps;
      });
    }
  };

  const activeAssets = useMemo(() => assets.filter(a => a.isEnabled), [assets]);
  const totalAssets = useMemo(() => activeAssets.reduce((sum, a) => sum + a.total, 0), [activeAssets]);
  const totalLiabilities = useMemo(() => liabilities.reduce((sum, l) => sum + l.balance, 0), [liabilities]);
  const totalWealth = totalAssets - totalLiabilities; // Net Worth

  const recordNetWorth = () => {
    if (!user) {
      setErrorMessage("Please sign in to save historical data.");
      return;
    }
    const id = Math.random().toString(36).substr(2, 9);
    const newRecord: HistoricalNetWorth = {
      id,
      date: new Date().toISOString(),
      totalAssets,
      totalLiabilities,
      netWorth: totalWealth
    };
    setHistoricalRecords(prev => [...prev, newRecord]);
    setDoc(doc(db, 'users', user.uid, 'historicalNetWorth', id), { ...newRecord, userId: user.uid }).catch(e => handleFirestoreError(e, OperationType.CREATE, `users/${user.uid}/historicalNetWorth/${id}`));
  };

  const totalCash = useMemo(() => 
    activeAssets
      .filter(a => a.type === 'Cash')
      .reduce((sum, a) => sum + a.total, 0), 
    [activeAssets]
  );
  const liquidCash = useMemo(() => {
    return activeAssets.reduce((sum, a) => {
      if (a.taxStatus === 'Roth') {
        return sum + (a.basis || 0);
      } else if (a.type === 'Cash' && !a.account.toLowerCase().includes('ira') && !a.account.toLowerCase().includes('401k')) {
        return sum + a.total;
      }
      return sum;
    }, 0);
  }, [activeAssets]);
  const runwayMonths = useMemo(() => calculateRunway(liquidCash, params.monthlySpend), [liquidCash, params.monthlySpend]);
  const portfolioBeta = useMemo(() => calculatePortfolioBeta(activeAssets), [activeAssets]);
  
  const fiTarget = useMemo(() => (params.monthlySpend * 12) / params.withdrawalRate, [params.monthlySpend, params.withdrawalRate]);
  
  const effectiveWealth = useMemo(() => {
    const adjustedAssets = activeAssets.reduce((sum, a) => {
      if (a.taxStatus === 'Pre-Tax') {
        return sum + (a.total * (1 - params.taxRate));
      }
      if (a.taxStatus === 'Locked') {
        return sum + (a.total * 0.9); // Reduced to 10% haircut for illiquidity
      }
      if (a.taxStatus === 'Roth') {
        const basis = a.basis || 0;
        const earnings = Math.max(0, a.total - basis);
        // Basis is liquid (1.0), earnings are locked (0.9)
        return sum + basis + (earnings * 0.9);
      }
      return sum + a.total;
    }, 0);
    return adjustedAssets - totalLiabilities;
  }, [activeAssets, params.taxRate, totalLiabilities]);

  const weightedExpectedReturn = useMemo(() => {
    if (totalWealth === 0) return params.expectedReturn;
    
    // Aggressiveness mapping:
    // 0 (Conservative): Stocks 40%, Real Estate 40%, Cash 20%
    // 1 (Moderate): Stocks 60%, Real Estate 30%, Cash 10%
    // 2 (Aggressive): Stocks 80%, Real Estate 15%, Cash 5%
    // 3 (Super Aggressive): Stocks 95%, Real Estate 5%, Cash 0%
    
    const allocations = [
      { stocks: 0.4, re: 0.4, cash: 0.2 },
      { stocks: 0.6, re: 0.3, cash: 0.1 },
      { stocks: 0.8, re: 0.15, cash: 0.05 },
      { stocks: 0.95, re: 0.05, cash: 0 },
    ][params.aggressiveness];

    // In a real app, we'd adjust the actual asset allocations.
    // For now, we adjust the expected return based on the aggressiveness slider.
    const baseReturn = params.expectedReturn;
    const reReturn = params.realEstateReturn;
    const cashReturn = 0.02; // Assume 2% cash return

    return (allocations.stocks * baseReturn) + (allocations.re * reReturn) + (allocations.cash * cashReturn);
  }, [totalWealth, params.expectedReturn, params.realEstateReturn, params.aggressiveness]);

  const fiYear = useMemo(() => 
    calculateFIYear(effectiveWealth, params.monthlySpend, params.monthlySavings, weightedExpectedReturn, params.withdrawalRate, params.inflationRate, params.careerAdjustment),
    [effectiveWealth, params.monthlySpend, params.monthlySavings, weightedExpectedReturn, params.withdrawalRate, params.inflationRate, params.careerAdjustment]
  );

  const mcResults = useMemo(() => 
    runMonteCarlo(totalWealth, params.retirementYears, weightedExpectedReturn, params.volatility, params.monthlySavings, params.inflationRate, params.marketCrash, params.careerAdjustment),
    [totalWealth, params.retirementYears, weightedExpectedReturn, params.volatility, params.monthlySavings, params.inflationRate, params.marketCrash, params.careerAdjustment]
  );

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 font-sans text-slate-900 dark:text-slate-100 overflow-hidden relative">
      {/* Desktop Sidebar (Permanent) */}
      <div className="hidden lg:block lg:w-64 xl:w-80 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 lg:bg-slate-50/50 lg:dark:bg-slate-950/50 shrink-0 overflow-y-auto">
        <Sidebar 
          params={params} 
          setParams={updateParams} 
          assets={assets}
          onUpdateAsset={updateAsset}
        />
      </div>

      {/* Mobile/Tablet Sidebar (Overlay) */}
      {isSidebarOpen && (
        <>
          <div 
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 lg:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 z-50 w-80 transform transition-transform duration-300 ease-in-out lg:hidden">
            <Sidebar 
              params={params} 
              setParams={updateParams} 
              assets={assets}
              onUpdateAsset={updateAsset}
              onClose={() => setIsSidebarOpen(false)}
            />
          </div>
        </>
      )}

      <main className="flex-1 overflow-y-auto pt-8 lg:pt-12 p-4 lg:p-8 min-w-0">
        <div id="dashboard-content" className="max-w-[95rem] mx-auto space-y-6 lg:space-y-8">
          {/* Error Toast */}
          {errorMessage && (
            <div className="fixed top-4 right-4 z-50 bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-lg shadow-lg flex items-start gap-3 max-w-md animate-in fade-in slide-in-from-top-4">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div className="flex-1 text-sm font-medium">{errorMessage}</div>
              <button 
                onClick={() => setErrorMessage(null)}
                className="p-1 hover:bg-rose-100 rounded-md transition-colors shrink-0"
              >
                <CloseIcon className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Header */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
            <div className="flex items-center gap-4 w-full md:w-auto">
              <button 
                onClick={() => setIsSidebarOpen(true)}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors lg:hidden"
              >
                <Menu className="w-6 h-6 text-slate-600" />
              </button>
              <div className="min-w-0">
                <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold tracking-tight text-slate-900 truncate">
                  {t('appName')} <span className="text-indigo-600">v2.0</span>
                </h1>
                <p className="text-xs md:text-sm text-slate-500 mt-1 font-medium truncate">
                  {t('appSubtitle')}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {user ? (
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 px-3 py-2 bg-indigo-50 border border-indigo-200 rounded-lg text-xs font-bold uppercase tracking-widest text-indigo-700 hover:bg-indigo-100 transition-all shadow-sm"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              ) : (
                <button
                  onClick={handleLogin}
                  className="flex items-center gap-2 px-3 py-2 bg-indigo-600 border border-indigo-700 rounded-lg text-xs font-bold uppercase tracking-widest text-white hover:bg-indigo-700 transition-all shadow-sm"
                >
                  <LogIn className="w-4 h-4" />
                  Sign In to Save
                </button>
              )}
              <button
                onClick={() => setCurrency(currency === 'USD' ? 'EUR' : 'USD')}
                className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold uppercase tracking-widest text-slate-600 hover:bg-slate-50 transition-all shadow-sm"
              >
                {currency}
              </button>
              <button
                onClick={() => setLanguage(language === 'en' ? 'es' : 'en')}
                className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold uppercase tracking-widest text-slate-600 hover:bg-slate-50 transition-all shadow-sm"
              >
                <Languages className="w-4 h-4 text-indigo-600" />
                {language === 'en' ? 'ES' : 'EN'}
              </button>
              <button 
                onClick={() => fetchPrices()}
                disabled={isSyncing}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
                title="Refresh Prices"
              >
                <TrendingUp className={`w-5 h-5 text-slate-400 ${isSyncing ? 'animate-pulse' : ''}`} />
              </button>
              <div className="text-right hidden sm:block">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  {isSyncing ? t('syncing') : t('lastMarketSync')}
                </p>
                <p className="text-sm font-mono font-bold text-slate-600">
                  {lastSync ? lastSync.toLocaleTimeString() : '—'}
                </p>
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-slate-200 dark:border-slate-800">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={cn(
                "px-4 py-3 text-sm font-medium transition-colors border-b-2",
                activeTab === 'dashboard' 
                  ? "border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400" 
                  : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300 hover:border-slate-300"
              )}
            >
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4" />
                {t('financialDashboard')}
              </div>
            </button>
            <button
              onClick={() => setActiveTab('healthcare')}
              className={cn(
                "px-4 py-3 text-sm font-medium transition-colors border-b-2",
                activeTab === 'healthcare' 
                  ? "border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400" 
                  : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300 hover:border-slate-300"
              )}
            >
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                {t('healthcareCosts')}
              </div>
            </button>
            <button
              onClick={() => setActiveTab('sabbatical')}
              className={cn(
                "px-4 py-3 text-sm font-medium transition-colors border-b-2",
                activeTab === 'sabbatical' 
                  ? "border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400" 
                  : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300 hover:border-slate-300"
              )}
            >
              <div className="flex items-center gap-2">
                <Briefcase className="w-4 h-4" />
                {t('sabbaticalTab')}
              </div>
            </button>
            <button
              onClick={() => setActiveTab('realEstate')}
              className={cn(
                "px-4 py-3 text-sm font-medium transition-colors border-b-2",
                activeTab === 'realEstate' 
                  ? "border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400" 
                  : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300 hover:border-slate-300"
              )}
            >
              <div className="flex items-center gap-2">
                <Home className="w-4 h-4" />
                {t('realEstateTab')}
              </div>
            </button>
          </div>

          {activeTab === 'healthcare' ? (
            <HealthcareCalculator />
          ) : activeTab === 'sabbatical' ? (
            <SabbaticalCalculator 
              assets={assets}
              expectedReturn={params.expectedReturn}
              realEstateReturn={params.realEstateReturn}
              monthlySpend={params.monthlySpend}
            />
          ) : activeTab === 'realEstate' ? (
            <RealEstateCalculator 
              properties={realEstateProperties}
              onUpdateProperty={(id, updates) => {
                setRealEstateProperties(prev => {
                  const newProps = prev.map(p => p.id === id ? { ...p, ...updates } : p);
                  if (user) {
                    const updatedProp = newProps.find(p => p.id === id);
                    if (updatedProp) {
                      setDoc(doc(db, 'users', user.uid, 'realEstate', id), { ...updatedProp, userId: user.uid }, { merge: true }).catch(e => handleFirestoreError(e, OperationType.UPDATE, `users/${user.uid}/realEstate/${id}`));
                    }
                  }
                  return newProps;
                });
              }}
              onAddProperty={(property) => {
                setRealEstateProperties(prev => [...prev, property]);
                if (user) {
                  setDoc(doc(db, 'users', user.uid, 'realEstate', property.id), { ...property, userId: user.uid }).catch(e => handleFirestoreError(e, OperationType.CREATE, `users/${user.uid}/realEstate/${property.id}`));
                }
              }}
              onDeleteProperty={(id) => {
                setRealEstateProperties(prev => prev.filter(p => p.id !== id));
                if (user) {
                  deleteDoc(doc(db, 'users', user.uid, 'realEstate', id)).catch(e => handleFirestoreError(e, OperationType.DELETE, `users/${user.uid}/realEstate/${id}`));
                }
              }}
              onSaveToLedger={handleSavePropertyToLedger} 
            />
          ) : (
            <>
              {/* Top Metrics */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
            <MetricCard
              title={params.marketCrash > 0 ? t('crashedNetWorth') : t('netWorth')}
              value={formatCurrency(params.marketCrash > 0 ? totalWealth * (1 - params.marketCrash) : totalWealth, currency)}
              subtitle={params.marketCrash > 0 ? `${t('originalValue')}: ${formatCurrency(totalWealth, currency)}` : `${t('netWorthCalculation')}`}
              icon={<Wallet className="w-5 h-5" />}
            />
            <MetricCard
              title={t('effectiveWealth')}
              value={formatCurrency(effectiveWealth, currency)}
              subtitle={t('effectiveWealthSubtitle')}
              icon={<Target className="w-5 h-5" />}
              info={`Effective Wealth is your Net Worth adjusted for future taxes (${(params.taxRate * 100).toFixed(0)}% haircut on Pre-Tax assets) and liquidity (10% haircut on Locked assets like Real Estate or Private Equity), minus your total liabilities.`}
            />
            <MetricCard
              title={t('timeToFi')}
              value={fiYear !== null ? `${fiYear.toFixed(1)} ${t('years')}` : t('never')}
              subtitle={`${t('fiTarget')}: ${formatCurrency(fiTarget, currency)}`}
              icon={<Target className="w-5 h-5" />}
              progress={totalWealth / fiTarget}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:gap-6">
            <MetricCard
              title={t('monthlySavings')}
              value={formatCurrency(params.monthlySavings, currency)}
              subtitle={t('monthlySavingsSubtitle')}
              icon={<TrendingUp className="w-5 h-5" />}
            />
            <MetricCard
              title={t('liquidityRunway')}
              value={`${runwayMonths.toFixed(1)} ${t('months')}`}
              subtitle={`${t('liquidityRunwaySubtitle')}: ${formatCurrency(liquidCash, currency)}`}
              icon={<Timer className="w-5 h-5" />}
              progress={runwayMonths / 24}
              info="Liquidity Runway measures how many months you can sustain your current spending using only immediately accessible cash (excluding retirement accounts like IRAs and 401ks)."
            />
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-4 gap-6">
            <div className="lg:col-span-1 2xl:col-span-1 space-y-6 min-w-0">
              <PortfolioChart assets={activeAssets} />
              <AggressivenessCard 
                aggressiveness={params.aggressiveness}
                onChange={(v) => updateParams({ ...params, aggressiveness: v })}
                totalWealth={totalWealth}
                currency={currency}
              />
            </div>
            <div className="lg:col-span-1 2xl:col-span-1 space-y-6 min-w-0">
              <TaxBreakdownChart assets={activeAssets} />
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-4">
                  {t('taxStrategy')}
                </h3>
                <div className="space-y-3">
                  {(() => {
                    const taxGroups = {
                      'Post-Tax': 0,
                      'Pre-Tax': 0,
                      'Locked': 0,
                    };
                    activeAssets.forEach(a => {
                      if (a.taxStatus === 'Roth') {
                        const basis = a.basis || 0;
                        const earnings = Math.max(0, a.total - basis);
                        taxGroups['Post-Tax'] += basis;
                        taxGroups['Locked'] += earnings;
                      } else if (a.taxStatus === 'Pre-Tax' || a.taxStatus === 'Post-Tax' || a.taxStatus === 'Locked') {
                        taxGroups[a.taxStatus] += a.total;
                      }
                    });

                    return [
                      { label: t('postTax'), status: 'Post-Tax', color: 'text-emerald-600' },
                      { label: t('preTax'), status: 'Pre-Tax', color: 'text-indigo-600' },
                      { label: t('locked'), status: 'Locked', color: 'text-amber-600' },
                    ].map((item) => {
                      const value = taxGroups[item.status as keyof typeof taxGroups];
                      const percentage = totalWealth > 0 ? (value / totalWealth) * 100 : 0;
                      return (
                        <div key={item.status} className="flex justify-between items-center gap-2">
                          <div className="flex flex-col min-w-0">
                            <span className="text-xs text-slate-500 truncate">{item.label}</span>
                            <span className="text-[10px] font-bold text-slate-400">{percentage.toFixed(1)}% {t('ofTotal')}</span>
                          </div>
                          <span className={`text-sm font-mono font-bold ${item.color} shrink-0`}>
                            {formatCurrency(value, currency)}
                          </span>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            </div>
            <div className="lg:col-span-2 2xl:col-span-2 min-w-0">
              <ProjectionChart paths={mcResults.paths} percentiles={mcResults.percentiles} />
            </div>
          </div>

          {/* Historical Net Worth */}
          <div className="w-full">
            <HistoricalChart 
              data={historicalRecords} 
              currency={currency} 
              onRecord={recordNetWorth} 
            />
          </div>
          
          {/* Portfolio Coach */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center gap-2 text-indigo-600">
              <BrainCircuit className="w-5 h-5" />
              <h3 className="text-sm font-bold uppercase tracking-wider">Portfolio Coach</h3>
            </div>
            <textarea
              value={coachPrompt}
              onChange={(e) => setCoachPrompt(e.target.value)}
              placeholder="Ask about your portfolio..."
              className="w-full p-3 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              rows={3}
            />
            <button
              onClick={askCoach}
              disabled={isCoaching}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 transition-colors disabled:bg-indigo-400"
            >
              {isCoaching ? 'Thinking...' : <><Send className="w-4 h-4" /> Ask Coach</>}
            </button>
            {coachResponse && (
              <div className="p-4 bg-slate-50 rounded-lg text-sm text-slate-700 whitespace-pre-wrap">
                {coachResponse}
              </div>
            )}
          </div>
          
          {/* Health Checks & Ledger */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4 gap-4 lg:gap-6">
            <HealthCard
              title={t('liquidityCheck')}
              status={totalCash / totalWealth < 0.10 ? 'error' : 'success'}
              message={totalCash / totalWealth < 0.10 
                ? t('liquidityLow') 
                : t('liquidityHealthy')}
              info="Liquidity Check represents the total amount of cash in your portfolio, including cash held within retirement accounts (IRA, 401k, etc.)."
            />
            <HealthCard
              title={t('volatilityCheck')}
              status={portfolioBeta > 1.2 ? 'warning' : 'info'}
              message={portfolioBeta > 1.2 
                ? `High Volatility: Portfolio Beta (${portfolioBeta.toFixed(2)}) is very high.` 
                : `Beta: ${portfolioBeta.toFixed(2)} (${t('marketCorrelation')})`}
              info="Portfolio Beta measures your wealth's sensitivity to market movements. A beta of 1.0 means your portfolio moves in sync with the market; higher values indicate more volatility and risk."
            />
            <HealthCard
              title={t('fiProgress')}
              status={totalWealth >= fiTarget ? 'success' : 'info'}
              message={totalWealth >= fiTarget 
                ? "Congratulations! You have reached Financial Independence." 
                : `${t('fiProgress')}: ${( (totalWealth / fiTarget) * 100 ).toFixed(1)}%`}
            />
            <HealthCard
              title={t('safeWithdrawal')}
              status={params.withdrawalRate > 0.05 ? 'error' : params.withdrawalRate > 0.04 ? 'warning' : 'success'}
              message={`${t('yearly')}: ${formatCurrency(totalWealth * params.withdrawalRate, currency)} | ${t('monthly')}: ${formatCurrency((totalWealth * params.withdrawalRate) / 12, currency)}`}
            />
          </div>

          {/* Ledger */}
          <LedgerTable 
            assets={assets} 
            currency={currency}
            onUpdateAsset={updateAsset} 
            onAddAsset={addAsset}
            onDeleteAsset={deleteAsset}
          />

          {/* Liabilities */}
          <LiabilitiesTable
            liabilities={liabilities}
            currency={currency}
            onUpdateLiability={updateLiability}
            onAddLiability={addLiability}
            onDeleteLiability={deleteLiability}
          />
            </>
          )}
        </div>
      </main>
    </div>
  );
}

interface HealthCardProps {
  title: string;
  status: 'success' | 'warning' | 'error' | 'info';
  message: string;
  info?: string;
}

function HealthCard({ title, status, message, info }: HealthCardProps) {
  const styles = {
    success: { bg: 'bg-emerald-50', border: 'border-emerald-100', text: 'text-emerald-700', icon: <CheckCircle2 className="w-4 h-4" /> },
    warning: { bg: 'bg-amber-50', border: 'border-amber-100', text: 'text-amber-700', icon: <AlertCircle className="w-4 h-4" /> },
    error: { bg: 'bg-rose-50', border: 'border-rose-100', text: 'text-rose-700', icon: <AlertCircle className="w-4 h-4" /> },
    info: { bg: 'bg-indigo-50', border: 'border-indigo-100', text: 'text-indigo-700', icon: <Info className="w-4 h-4" /> },
  };

  const current = styles[status];

  return (
    <div className={`p-3 lg:p-4 rounded-xl border ${current.bg} ${current.border} flex gap-3 items-start relative group min-w-0`}>
      <div className={cn("shrink-0", current.text)}>{current.icon}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between mb-1 gap-2">
          <h4 className={`text-[10px] font-bold uppercase tracking-widest ${current.text} leading-tight truncate`}>{title}</h4>
          {info && (
            <div className="relative shrink-0">
              <Info className="w-3 h-3 text-slate-400 cursor-help" />
              <div className="absolute top-full right-0 mt-2 w-48 p-2 bg-slate-900 text-white text-[10px] rounded shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                {info}
              </div>
            </div>
          )}
        </div>
        <p className="text-sm font-medium text-slate-700 leading-snug break-words">{message}</p>
      </div>
    </div>
  );
}
