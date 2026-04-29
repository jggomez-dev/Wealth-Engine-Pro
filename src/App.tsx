import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Asset, SimulationParams, SimulationPath, Liability, HistoricalNetWorth, PropertyConfig, AssetType } from './types';
import { runMonteCarlo, calculatePortfolioBeta, calculateRunway, calculateFIYear, MonteCarloResults, parseVal } from './utils/finance';
import { getPortfolioInsight } from './services/geminiService';
import { formatCurrency, cn } from './lib/utils';
import { ErrorBoundary } from './components/ErrorBoundary';
import Sidebar from './components/Sidebar';
import MetricCard from './components/MetricCard';
import PortfolioChart from './components/PortfolioChart';
import ProjectionChart from './components/ProjectionChart';
import LedgerTable from './components/LedgerTable';
import LiabilitiesTable from './components/LiabilitiesTable';
import HistoricalChart from './components/HistoricalChart';
import TaxBreakdownChart from './components/TaxBreakdownChart';
import { HealthcareCalculator } from './components/HealthcareCalculator';
import SabbaticalCalculator from './components/SabbaticalCalculator';
import GuardrailsCalculator from './components/GuardrailsCalculator';
import PortfolioStrategy from './components/PortfolioStrategy';
import HealthCard from './components/HealthCard';
import RealEstateCalculator, { RealEstatePropertyData, DEFAULT_PROPERTY } from './components/RealEstateCalculator';
import { Wallet, Timer, TrendingUp, AlertCircle, CheckCircle2, Info, Target, Menu, X as CloseIcon, Languages, BrainCircuit, Send, LogIn, LogOut, Activity, Briefcase, Home, ShieldAlert, AlertTriangle, ArrowRight } from 'lucide-react';
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

// Metric constants (nominal expected returns and volatility)
const ASSET_CLASS_METRICS: Record<AssetType, { mu: number; sigma: number }> = {
  'Domestic Stock': { mu: 0.08, sigma: 0.15 },
  'International Stock': { mu: 0.07, sigma: 0.18 },
  'Bonds': { mu: 0.04, sigma: 0.06 },
  'Real Estate': { mu: 0.05, sigma: 0.10 },
  'Cash': { mu: 0.02, sigma: 0.005 },
  'Crypto': { mu: 0.15, sigma: 0.70 },
  'Gold': { mu: 0.04, sigma: 0.15 },
  'Private': { mu: 0.12, sigma: 0.25 }
};

export default function App() {
  const { t, language, setLanguage } = useLanguage();
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  
  const [assets, setAssets] = useState<Asset[]>(INITIAL_ASSETS);
  const assetsRef = useRef<Asset[]>(INITIAL_ASSETS);
  useEffect(() => {
    assetsRef.current = assets;
  }, [assets]);
  
  const [liabilities, setLiabilities] = useState<Liability[]>([]);
  const [historicalRecords, setHistoricalRecords] = useState<HistoricalNetWorth[]>([]);
  const [realEstateProperties, setRealEstateProperties] = useState<PropertyConfig[]>([
    { id: '1', name: 'Primary Residence', ...DEFAULT_PROPERTY, linkedAssetId: '12' }
  ]);
  const [currency, setCurrency] = useState<'USD' | 'EUR'>('USD');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'calculators' | 'realEstate' | 'portfolioStrategy'>('dashboard');
  const [calculatorSubTab, setCalculatorSubTab] = useState<'healthcare' | 'sabbatical' | 'guardrails'>('healthcare');
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
    rebalanceThreshold: 5, // Default to 5%
    portfolioTargets: {
      'Domestic Stock': 50,
      'International Stock': 20,
      'Bonds': 10,
      'Real Estate': 10,
      'Cash': 5,
      'Crypto': 5,
      'Gold': 0,
      'Private': 0
    }
  });
  const [isSyncing, setIsSyncing] = useState(false);
  const isSyncingRef = useRef(false);
  useEffect(() => {
    isSyncingRef.current = isSyncing;
  }, [isSyncing]);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [coachPrompt, setCoachPrompt] = useState('');
  const [coachResponse, setCoachResponse] = useState('');
  const [isCoaching, setIsCoaching] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isRebalanceAlertDismissed, setIsRebalanceAlertDismissed] = useState(false);

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
  const fetchPrices = async (currentAssets?: Asset[], forceClearCache: boolean = false) => {
    if (isSyncingRef.current && !forceClearCache) return; // Prevent concurrent syncs
    setIsSyncing(true);
    const targetAssets = currentAssets || assetsRef.current;
    const tickers = Array.from(new Set(targetAssets
      .filter(a => a.ticker && a.ticker !== 'CASH' && (a.qty > 0 || (a.type !== 'Private' && a.type !== 'Real Estate' && a.ticker !== 'Primary Res' && a.ticker !== 'Company Dtm')))
      .map(a => {
        let t = a.ticker.toUpperCase().trim().replace(/[\.\s_]/g, '-');
        if (t === 'BRKB') t = 'BRK-B';
        if (t === 'BRKA') t = 'BRK-A';
        if (t === 'BFB') t = 'BF-B';
        if (t === 'BFA') t = 'BF-A';
        return t;
      })
    )).join(',');
    
    if (!tickers) {
      setIsSyncing(false);
      return;
    }

    const maxRetries = 2;
    let attempt = 0;
    let lastError: Error | null = null;

    while (attempt <= maxRetries) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000); 
        
        const response = await fetch('/api/prices', { 
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tickers, clearCache: forceClearCache }),
          signal: controller.signal 
        });
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          throw new Error(`Sync failed: ${response.statusText}`);
        }
        
        const rawText = await response.text();
        let priceMap;
        try {
          priceMap = JSON.parse(rawText);
        } catch(e) {
          console.error("Invalid JSON response. Raw text received: ", rawText.substring(0, 200));
          throw new Error("Invalid format from server: " + rawText.substring(0, 50));
        }

        if (priceMap && typeof priceMap === 'object') {
          console.log("Price sync completed. Received Map:", priceMap);
        } else {
          throw new Error("Invalid response from price server");
        }
        
        setAssets(prev => {
          const batch = auth.currentUser ? writeBatch(db) : null;
          let hasUpdates = false;

          const newAssets = prev.map(asset => {
            let checkTicker = asset.ticker;
            if (checkTicker) {
              checkTicker = checkTicker.toUpperCase().trim().replace(/[\.\s_]/g, '-');
            }
            if (checkTicker === 'BRK-B' || checkTicker === 'BRKB') checkTicker = 'BRK-B';
            if (checkTicker === 'BRK-A' || checkTicker === 'BRKA') checkTicker = 'BRK-A';
            if (checkTicker === 'BF-B' || checkTicker === 'BFB') checkTicker = 'BF-B';
            if (checkTicker === 'BF-A' || checkTicker === 'BFA') checkTicker = 'BF-A';

            if (priceMap[checkTicker] !== undefined) {
              const price = priceMap[checkTicker];
              const qty = Number(asset.qty) || 0;
              let newTotal = asset.total;
              
              if (qty > 0 && asset.type !== 'Real Estate' && asset.type !== 'Private' && asset.ticker !== 'Primary Res' && asset.ticker !== 'Company Dtm') {
                 newTotal = qty * price;
              }

              const updatedAsset = { ...asset, price, ticker: checkTicker, total: newTotal };
              
              if (auth.currentUser && batch) {
                batch.set(doc(db, 'users', auth.currentUser.uid, 'assets', asset.id), { ...updatedAsset, userId: auth.currentUser.uid }, { merge: true });
                hasUpdates = true;
              }
              return updatedAsset;
            }
            return asset;
          });

          if (batch && hasUpdates) {
            batch.commit().catch(e => console.error("Batch update failed:", e));
          }

          return newAssets;
        });
        setLastSync(new Date());
        setIsSyncing(false);
        return; // Success, exit retry loop
      } catch (error) {
        lastError = error as Error;
        console.warn(`Price sync attempt ${attempt + 1} failed:`, error);
        attempt++;
        if (attempt <= maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 3000 * attempt));
        }
      }
    }

    if (lastError) {
      console.error("Failed to sync prices after retries:", lastError);
    }
    setIsSyncing(false);
  };

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchPrices();
      }
    };
    
    const handleFocus = () => {
      fetchPrices();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

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
    const interval = setInterval(() => fetchPrices(), 3600000);
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
          const settings = docSnap.data().settings;
          setParams(prev => ({
            ...prev,
            ...settings,
            // Ensure new fields have defaults if missing from old saved data
            rebalanceThreshold: settings.rebalanceThreshold ?? 5
          }));
        }
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
      });

      // Listen to Assets
      let isFirstAssetsLoad = true;
      const unsubAssets = onSnapshot(collection(db, 'users', user.uid, 'assets'), (snapshot) => {
        if (!snapshot.empty) {
          const loadedAssets = snapshot.docs.map(doc => {
            const data = doc.data();
            const parse = (v: any) => {
              if (typeof v === 'string') return parseFloat(v.replace(/,/g, '')) || 0;
              return Number(v) || 0;
            };
            return { 
              id: doc.id, 
              ...data,
              total: parse(data.total),
              qty: parse(data.qty),
              price: parse(data.price),
              basis: parse(data.basis),
              isEnabled: data.isEnabled !== false,
            } as Asset;
          });
          
          // Fix known typo/split accounts "IRA 1 I" -> "IRA 1" and "IRA 2 J" -> "IRA 2"
          let needsUpdate = false;
          const cleanedAssets = loadedAssets.map(a => {
            let nextAcc = a.account;
            // Also trim all accounts
            if (nextAcc && nextAcc.trim() !== nextAcc) nextAcc = nextAcc.trim();

            // Fix specific errors mentioned by user
            if (nextAcc && nextAcc.toUpperCase() === 'IRA 1 I') nextAcc = 'IRA 1';
            if (nextAcc && nextAcc.toUpperCase() === 'IRA 2 J') nextAcc = 'IRA 2';
            if (nextAcc && nextAcc.toUpperCase() === 'ROTH IRA J') nextAcc = 'Roth IRA 2';
            if (nextAcc && nextAcc.toUpperCase() === 'ROTH IRA I') nextAcc = 'Roth IRA 1';
            if (nextAcc && nextAcc.toUpperCase() === 'ROTH IRA 1 I') nextAcc = 'Roth IRA 1';
            if (nextAcc && nextAcc.toUpperCase() === 'ROTH IRA 2 J') nextAcc = 'Roth IRA 2';

            // Normalize common capitalization differences for Roth IRA
            if (nextAcc && nextAcc.toUpperCase() === 'ROTH IRA') nextAcc = 'Roth IRA';
            if (nextAcc && nextAcc.toUpperCase() === 'ROTH IRA 1') nextAcc = 'Roth IRA 1';
            if (nextAcc && nextAcc.toUpperCase() === 'ROTH IRA 2') nextAcc = 'Roth IRA 2';
            
            let nextTicker = a.ticker;
            if (nextTicker) {
               nextTicker = nextTicker.toUpperCase().trim().replace(/[\.\s_]/g, '-');
            }
            if (nextTicker === 'BRKB') nextTicker = 'BRK-B';
            if (nextTicker === 'BRKA') nextTicker = 'BRK-A';
            if (nextTicker === 'BFB') nextTicker = 'BF-B';
            if (nextTicker === 'BFA') nextTicker = 'BF-A';

            if (nextAcc !== a.account || nextTicker !== a.ticker) {
              needsUpdate = true;
              return { ...a, account: nextAcc, ticker: nextTicker, isDirty: true };
            }
            return a;
          });

          if (needsUpdate) {
            const batch = writeBatch(db);
            cleanedAssets.forEach(a => {
               if ((a as any).isDirty) {
                 const { isDirty, ...dataToSave } = a as any;
                 batch.update(doc(db, 'users', user.uid, 'assets', a.id), { account: a.account, ticker: a.ticker });
               }
            });
            batch.commit().catch(e => console.error("Failed to clean up account names:", e));
          }

          const finalAssets = cleanedAssets.map(a => {
            const { isDirty, ...rest } = a as any;
            return rest as Asset;
          });

          setAssets(finalAssets);
          if (isFirstAssetsLoad) {
            isFirstAssetsLoad = false;
            fetchPrices(finalAssets);
          }
        }
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/assets`);
      });

      // Listen to Liabilities
      const unsubLiabilities = onSnapshot(collection(db, 'users', user.uid, 'liabilities'), (snapshot) => {
        if (!snapshot.empty) {
          const loadedLiabilities = snapshot.docs.map(doc => {
            const data = doc.data();
            const parse = (v: any) => {
              if (typeof v === 'string') return parseFloat(v.replace(/,/g, '')) || 0;
              return Number(v) || 0;
            };
            return {
              id: doc.id,
              ...data,
              balance: parse(data.balance),
              interestRate: parse(data.interestRate),
              minimumPayment: parse(data.minimumPayment)
            } as Liability;
          });
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
          if (('qty' in updates || 'price' in updates) && !('total' in updates) && updated.price !== undefined && updated.ticker !== 'CASH') {
            const qty = Number(updated.qty) || 0;
            const price = Number(updated.price) || 0;
            // Only auto-calculate total if it's a standard ticker/quantity asset
            if (qty > 0 && updated.type !== 'Real Estate' && updated.type !== 'Private' && updated.ticker !== 'Primary Res' && updated.ticker !== 'Company Dtm') {
              updated.total = qty * price;
            }
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
    
    // Normalize ticker on creation
    let normalizedTicker = asset.ticker;
    if (normalizedTicker && normalizedTicker !== 'CASH') {
      normalizedTicker = normalizedTicker.toUpperCase().trim().replace(/[\.\s_]/g, '-');
      if (normalizedTicker === 'BRKB') normalizedTicker = 'BRK-B';
      if (normalizedTicker === 'BRKA') normalizedTicker = 'BRK-A';
      if (normalizedTicker === 'BFB') normalizedTicker = 'BF-B';
      if (normalizedTicker === 'BFA') normalizedTicker = 'BF-A';
    }

    const newAsset: Asset = { ...asset, id, ticker: normalizedTicker };
    
    // Ensure total is calculated if qty and price are present
    if (newAsset.qty && newAsset.price && !newAsset.total) {
      newAsset.total = newAsset.qty * newAsset.price;
    }
    
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
  
  const netAssetsForCharts = useMemo(() => {
    const clonedAssets = activeAssets.map(a => ({ ...a, total: parseVal(a.total) }));
    
    // 1. Linked Liabilities (Mortgages usually)
    const linkedLiabilityBalances: Record<string, number> = {};
    const linkedLiabilityIds = new Set<string>();

    realEstateProperties.forEach(prop => {
      if (prop.linkedAssetId && prop.linkedLiabilityId) {
        const liability = liabilities.find(l => l.id === prop.linkedLiabilityId);
        if (liability) {
          linkedLiabilityBalances[prop.linkedAssetId] = (linkedLiabilityBalances[prop.linkedAssetId] || 0) + parseVal(liability.balance);
          linkedLiabilityIds.add(prop.linkedLiabilityId);
        }
      }
    });

    // Subtract linked liabilities from their assets
    clonedAssets.forEach(asset => {
      if (linkedLiabilityBalances[asset.id]) {
        asset.total = Math.max(0, asset.total - linkedLiabilityBalances[asset.id]);
      }
    });

    // 2. Unlinked Liabilities (The "Equity Gap")
    let unlinkedLiabilityTotal = liabilities
      .filter(l => !linkedLiabilityIds.has(l.id))
      .reduce((sum, l) => sum + parseVal(l.balance), 0);

    // Subtract remaining debt from assets in order of liquidity
    // (Cash, then Stocks, then others)
    const liquidityOrder: AssetType[] = ['Cash', 'Domestic Stock', 'International Stock', 'Crypto', 'Gold', 'Bonds', 'Private', 'Real Estate'];
    
    const sortedAssets = [...clonedAssets].sort((a, b) => {
      const idxA = liquidityOrder.indexOf(a.type);
      const idxB = liquidityOrder.indexOf(b.type);
      return (idxA === -1 ? 99 : idxA) - (idxB === -1 ? 99 : idxB);
    });

    for (const asset of sortedAssets) {
      if (unlinkedLiabilityTotal <= 0) break;
      if (asset.total > 0) {
        const toSubtract = Math.min(asset.total, unlinkedLiabilityTotal);
        asset.total -= toSubtract;
        unlinkedLiabilityTotal -= toSubtract;
      }
    }

    return sortedAssets;
  }, [activeAssets, liabilities, realEstateProperties]);

  const strategyCategories = useMemo(() => {
    return Object.keys(params.portfolioTargets || {}) as AssetType[];
  }, [params.portfolioTargets]);

  const portfolioData = useMemo(() => {
    const totalsByType: Record<string, number> = {};
    netAssetsForCharts.forEach(asset => {
      totalsByType[asset.type] = (totalsByType[asset.type] || 0) + (Number(asset.total) || 0);
    });

    const strategyTotalValue = strategyCategories.reduce((sum, type) => sum + (totalsByType[type] || 0), 0);

    return strategyCategories.map(type => {
      const currentTotal = totalsByType[type] || 0;
      const currentAllocation = strategyTotalValue > 0 ? (currentTotal / strategyTotalValue) * 100 : 0;
      const targetAllocation = params.portfolioTargets?.[type] || 0;
      const drift = currentAllocation - targetAllocation;
      const isOutofWhack = Math.abs(drift) > params.rebalanceThreshold;
      
      const targetValue = strategyTotalValue * (targetAllocation / 100);
      const rebalanceAmount = targetValue - currentTotal;

      return {
        type,
        currentTotal,
        currentAllocation,
        targetAllocation,
        targetValue,
        drift,
        isOutofWhack,
        rebalanceAmount
      };
    }).sort((a, b) => b.currentTotal - a.currentTotal);
  }, [netAssetsForCharts, params.rebalanceThreshold, params.portfolioTargets, strategyCategories]);

  const strategyTotalValue = useMemo(() => portfolioData.reduce((sum, a) => sum + a.currentTotal, 0), [portfolioData]);
  const outOfWhackCount = useMemo(() => portfolioData.filter(d => d.isOutofWhack && d.targetAllocation > 0).length, [portfolioData]);

  const dynamicAssetMetrics = useMemo(() => {
    let reReturn = ASSET_CLASS_METRICS['Real Estate'].mu;
    
    if (realEstateProperties.length > 0) {
      let totalInvested = 0;
      let totalWeightedReturn = 0;

      realEstateProperties.forEach(p => {
        const {
          purchasePrice, downPaymentPercent, closingCosts, rehabCosts,
          grossRent, otherIncome, propertyTaxes, insurance, hoa,
          repairsPercent, vacancyPercent, capexPercent, managementPercent,
          interestRate, loanTerm, currentLoanBalanceOverride,
          appreciationRate
        } = p;

        const totalOutOfPocket = (purchasePrice * (downPaymentPercent / 100)) + closingCosts + rehabCosts;
        
        const monthlyIncome = grossRent + otherIncome;
        const monthlyTaxes = propertyTaxes / 12;
        const monthlyInsurance = insurance / 12;
        const monthlyExpenses = monthlyTaxes + monthlyInsurance + hoa + (monthlyIncome * (repairsPercent + vacancyPercent + capexPercent + managementPercent) / 100);
        const monthlyNOI = monthlyIncome - monthlyExpenses;
        
        const loanAmount = (currentLoanBalanceOverride && currentLoanBalanceOverride > 0) 
            ? currentLoanBalanceOverride 
            : purchasePrice * (1 - downPaymentPercent / 100);
            
        let monthlyMortgage = 0;
        if (loanAmount > 0 && interestRate > 0) {
          const r = (interestRate / 100) / 12;
          const totalPayments = loanTerm * 12;
          monthlyMortgage = (loanAmount * r * Math.pow(1 + r, totalPayments)) / (Math.pow(1 + r, totalPayments) - 1);
        }
        
        const annualCashFlow = (monthlyNOI - monthlyMortgage) * 12;
        const cashOnCash = totalOutOfPocket > 0 ? (annualCashFlow / totalOutOfPocket) : 0;
        const totalPropReturn = cashOnCash + (appreciationRate / 100);

        totalInvested += totalOutOfPocket;
        totalWeightedReturn += totalPropReturn * totalOutOfPocket;
      });

      if (totalInvested > 0) {
        reReturn = totalWeightedReturn / totalInvested;
      }
    }

    return {
      ...ASSET_CLASS_METRICS,
      'Real Estate': { mu: reReturn, sigma: ASSET_CLASS_METRICS['Real Estate'].sigma }
    };
  }, [realEstateProperties]);

  const currentAllocationMetrics = useMemo(() => {
    if (strategyTotalValue === 0) return { mu: 0.07, sigma: 0.15 };
    let weightedMu = 0;
    let weightedSigma = 0;
    
    portfolioData.forEach(p => {
      const weight = p.currentTotal / strategyTotalValue;
      const metrics = dynamicAssetMetrics[p.type as AssetType] || dynamicAssetMetrics['Domestic Stock'];
      weightedMu += weight * metrics.mu;
      weightedSigma += weight * metrics.sigma;
    });
    
    return { mu: weightedMu, sigma: weightedSigma };
  }, [portfolioData, strategyTotalValue, dynamicAssetMetrics]);

  const targetAllocationMetrics = useMemo(() => {
    let weightedMu = 0;
    let weightedSigma = 0;
    
    portfolioData.forEach(p => {
      const weight = p.targetAllocation / 100;
      const metrics = dynamicAssetMetrics[p.type as AssetType] || dynamicAssetMetrics['Domestic Stock'];
      weightedMu += weight * metrics.mu;
      weightedSigma += weight * metrics.sigma;
    });
    
    return { mu: weightedMu, sigma: weightedSigma };
  }, [portfolioData, dynamicAssetMetrics]);

  const totalAssets = useMemo(() => activeAssets.reduce((sum, a) => sum + parseVal(a.total), 0), [activeAssets]);

  const totalLiabilities = useMemo(() => liabilities.reduce((sum, l) => sum + parseVal(l.balance), 0), [liabilities]);

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
      .reduce((sum, a) => sum + parseVal(a.total), 0), 
    [activeAssets]
  );
  const liquidCash = useMemo(() => {
    return activeAssets.reduce((sum, a) => {
      if (a.taxStatus === 'Roth') {
        return sum + parseVal(a.basis);
      } else if (a.type === 'Cash' && !(a.account || '').toLowerCase().includes('ira') && !(a.account || '').toLowerCase().includes('401k')) {
        return sum + parseVal(a.total);
      }
      return sum;
    }, 0);
  }, [activeAssets]);
  const runwayMonths = useMemo(() => calculateRunway(liquidCash, params.monthlySpend), [liquidCash, params.monthlySpend]);
  const portfolioBeta = useMemo(() => calculatePortfolioBeta(netAssetsForCharts), [netAssetsForCharts]);
  
  const fiTarget = useMemo(() => (params.monthlySpend * 12) / params.withdrawalRate, [params.monthlySpend, params.withdrawalRate]);
  
  const effectiveWealth = useMemo(() => {
    const adjustedAssets = activeAssets.reduce((sum, a) => {
      const tot = parseVal(a.total);
      if (a.taxStatus === 'Pre-Tax') {
        return sum + (tot * (1 - params.taxRate));
      }
      if (a.taxStatus === 'Locked') {
        return sum + (tot * 0.9); // Reduced to 10% haircut for illiquidity
      }
      if (a.taxStatus === 'Roth') {
        const basis = parseVal(a.basis);
        const earnings = Math.max(0, tot - basis);
        // Basis is liquid (1.0), earnings are locked (0.9)
        return sum + basis + (earnings * 0.9);
      }
      return sum + tot;
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

  const needsRebalance = useMemo(() => {
    return outOfWhackCount > 0 && !isRebalanceAlertDismissed;
  }, [outOfWhackCount, isRebalanceAlertDismissed]);

  return (
    <ErrorBoundary>
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
        <ErrorBoundary>
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
                  {t('signOut')}
                </button>
              ) : (
                <button
                  onClick={handleLogin}
                  className="flex items-center gap-2 px-3 py-2 bg-indigo-600 border border-indigo-700 rounded-lg text-xs font-bold uppercase tracking-widest text-white hover:bg-indigo-700 transition-all shadow-sm"
                >
                  <LogIn className="w-4 h-4" />
                  {t('signIn')}
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
                onClick={() => fetchPrices(undefined, true)}
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
          <div className="flex border-b border-slate-200 dark:border-slate-800 overflow-x-auto">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={cn(
                "px-4 py-3 text-sm font-medium transition-colors border-b-2 whitespace-nowrap",
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
              onClick={() => setActiveTab('realEstate')}
              className={cn(
                "px-4 py-3 text-sm font-medium transition-colors border-b-2 whitespace-nowrap",
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
            <button
              onClick={() => setActiveTab('calculators')}
              className={cn(
                "px-4 py-3 text-sm font-medium transition-colors border-b-2 whitespace-nowrap",
                activeTab === 'calculators' 
                  ? "border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400" 
                  : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300 hover:border-slate-300"
              )}
            >
              <div className="flex items-center gap-2">
                <BrainCircuit className="w-4 h-4" />
                {t('calculators')}
              </div>
            </button>
            <button
              onClick={() => setActiveTab('portfolioStrategy')}
              className={cn(
                "px-4 py-3 text-sm font-medium transition-colors border-b-2 whitespace-nowrap",
                activeTab === 'portfolioStrategy' 
                  ? "border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400" 
                  : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300 hover:border-slate-300"
              )}
            >
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4" />
                {t('portfolioStrategy')}
              </div>
            </button>
          </div>

          {activeTab === 'calculators' ? (
            <div className="space-y-6">
              <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl w-fit">
                <button
                  onClick={() => setCalculatorSubTab('healthcare')}
                  className={cn(
                    "px-4 py-2 text-xs font-bold uppercase tracking-widest rounded-lg transition-all",
                    calculatorSubTab === 'healthcare' 
                      ? "bg-white dark:bg-slate-900 text-indigo-600 shadow-sm"
                      : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                  )}
                >
                  {t('healthcareCosts')}
                </button>
                <button
                  onClick={() => setCalculatorSubTab('sabbatical')}
                  className={cn(
                    "px-4 py-2 text-xs font-bold uppercase tracking-widest rounded-lg transition-all",
                    calculatorSubTab === 'sabbatical' 
                      ? "bg-white dark:bg-slate-900 text-indigo-600 shadow-sm"
                      : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                  )}
                >
                  {t('sabbaticalTab')}
                </button>
                <button
                  onClick={() => setCalculatorSubTab('guardrails')}
                  className={cn(
                    "px-4 py-2 text-xs font-bold uppercase tracking-widest rounded-lg transition-all",
                    calculatorSubTab === 'guardrails' 
                      ? "bg-white dark:bg-slate-900 text-indigo-600 shadow-sm"
                      : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                  )}
                >
                  {t('guardrailsTab')}
                </button>
              </div>

              {calculatorSubTab === 'healthcare' && <HealthcareCalculator />}
              {calculatorSubTab === 'sabbatical' && (
                <SabbaticalCalculator 
                  assets={netAssetsForCharts}
                  realEstateProperties={realEstateProperties}
                  expectedReturn={params.expectedReturn}
                  realEstateReturn={params.realEstateReturn}
                  monthlySpend={params.monthlySpend}
                />
              )}
              {calculatorSubTab === 'guardrails' && (
                <GuardrailsCalculator 
                  initialWealth={totalWealth}
                  expectedReturn={params.expectedReturn}
                  inflationRate={params.inflationRate}
                  currency={currency}
                />
              )}
            </div>
          ) : activeTab === 'portfolioStrategy' ? (
            <PortfolioStrategy 
              assets={netAssetsForCharts}
              params={params}
              setParams={updateParams}
              portfolioData={portfolioData}
              strategyTotalValue={strategyTotalValue}
              outOfWhackCount={outOfWhackCount}
              currentMetrics={currentAllocationMetrics}
              targetMetrics={targetAllocationMetrics}
              mcResults={mcResults}
              currency={currency}
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
              {needsRebalance && (
                <div 
                  className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-4 flex items-center justify-between gap-4 transition-colors group relative"
                >
                  <div 
                    onClick={() => setActiveTab('portfolioStrategy')}
                    className="flex flex-1 items-center gap-4 cursor-pointer"
                  >
                    <div className="p-2 bg-amber-100 dark:bg-amber-800 rounded-lg">
                      <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-amber-900 dark:text-amber-100">
                        {t('rebalanceNeeded')}
                      </h3>
                      <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
                        {t('rebalanceNeededDesc').replace('{threshold}', params.rebalanceThreshold.toString())}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div 
                      onClick={() => setActiveTab('portfolioStrategy')}
                      className="flex items-center gap-1 text-xs font-bold text-amber-700 dark:text-amber-400 group-hover:translate-x-1 transition-transform cursor-pointer"
                    >
                      {t('portfolioStrategy')}
                      <ArrowRight className="w-4 h-4" />
                    </div>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsRebalanceAlertDismissed(true);
                      }}
                      className="p-1.5 hover:bg-amber-100 dark:hover:bg-amber-800 rounded-lg text-amber-400 hover:text-amber-600 transition-colors"
                      title="Dismiss"
                    >
                      <CloseIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* Top Metrics */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
                <MetricCard
                  title="Live Net Worth"
                  value={formatCurrency(totalWealth, currency)}
                  subtitle="Real-time ledger sync"
                  icon={<Wallet className="w-5 h-5 text-indigo-500" />}
                />
                <MetricCard
                  title={t('effectiveWealth')}
                  value={formatCurrency(effectiveWealth, currency)}
                  subtitle={t('effectiveWealthSubtitle')}
                  icon={<Target className="w-5 h-5 text-blue-500" />}
                  info={t('effectiveWealthInfo')}
                />
                <MetricCard
                  title={t('timeToFi')}
                  value={fiYear !== null ? `${fiYear.toFixed(1)} ${t('years')}` : t('never')}
                  subtitle={`${t('fiTarget')}: ${formatCurrency(fiTarget, currency)}`}
                  icon={<Target className="w-5 h-5 text-emerald-500" />}
                  progress={totalWealth > 0 ? totalWealth / fiTarget : 0}
                />
                <MetricCard
                  title={t('liquidityRunway')}
                  value={`${runwayMonths.toFixed(1)} ${t('months')}`}
                  subtitle={`${t('liquidityRunwaySubtitle')}: ${formatCurrency(liquidCash, currency)}`}
                  icon={<Timer className="w-5 h-5 text-amber-500" />}
                  progress={runwayMonths / 24}
                  info={t('liquidityRunwayInfo')}
                />
              </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="min-w-0">
              <PortfolioChart assets={netAssetsForCharts} />
            </div>
            <div className="min-w-0">
              <TaxBreakdownChart assets={netAssetsForCharts} currency={currency} />
            </div>
          </div>
          
          <div className="w-full">
            <ProjectionChart paths={mcResults.paths} percentiles={mcResults.percentiles} />
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
              <h3 className="text-sm font-bold uppercase tracking-wider">{t('portfolioCoach')}</h3>
            </div>
            <textarea
              value={coachPrompt}
              onChange={(e) => setCoachPrompt(e.target.value)}
              placeholder={t('askAboutPortfolio')}
              className="w-full p-3 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              rows={3}
            />
            <button
              onClick={askCoach}
              disabled={isCoaching}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 transition-colors disabled:bg-indigo-400"
            >
              {isCoaching ? t('thinking') : <><Send className="w-4 h-4" /> {t('askCoach')}</>}
            </button>
            {coachResponse && (
              <div className="p-4 bg-slate-50 rounded-lg text-sm text-slate-700 whitespace-pre-wrap">
                {coachResponse}
              </div>
            )}
          </div>

          {/* Health Checks */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
            <HealthCard
              title={t('liquidityCheck')}
              status={totalCash / totalWealth < 0.10 ? 'error' : 'success'}
              message={totalCash / totalWealth < 0.10 
                ? t('liquidityLow') 
                : t('liquidityHealthy')}
              info={t('liquidityCheckInfo')}
            />
            <HealthCard
              title={t('volatilityCheck')}
              status={portfolioBeta > 1.2 ? 'warning' : 'info'}
              message={portfolioBeta > 1.2 
                ? t('highVolatility').replace('{beta}', portfolioBeta.toFixed(2)) 
                : t('moderateVolatility').replace('{beta}', portfolioBeta.toFixed(2)).replace('{correlation}', t('marketCorrelation'))}
              info={t('volatilityCheckInfo')}
            />
            <HealthCard
              title={t('fiProgressTitle')}
              status={totalWealth >= fiTarget ? 'success' : 'info'}
              message={totalWealth >= fiTarget 
                ? t('fiReached')
                : t('fiProgressPercent').replace('{percent}', ((totalWealth / fiTarget) * 100).toFixed(1))}
            />
            <HealthCard
              title={t('safeWithdrawalTitle')}
              status={params.withdrawalRate > 0.05 ? 'error' : params.withdrawalRate > 0.04 ? 'warning' : 'success'}
              message={`${t('yearly')}: ${formatCurrency(totalWealth * params.withdrawalRate, currency)} | ${t('monthly')}: ${formatCurrency((totalWealth * params.withdrawalRate) / 12, currency)}`}
            />
          </div>
          
          {activeTab === 'dashboard' && (
            <>
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
          </>
        )}
        </div>
      </ErrorBoundary>
    </main>
  </div>
</ErrorBoundary>
  );
}
