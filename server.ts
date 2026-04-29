import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import dns from "node:dns";

// Force IPv4 resolution first to avoid IPv6 timeout issues in the container
dns.setDefaultResultOrder("ipv4first");

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import nodeFetch from 'node-fetch';

import fs from 'fs';

// Lazy initialization for Firebase Admin
let db: any = null;

function getDb() {
  if (db) return db;
  
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!serviceAccount) {
    console.error("FIREBASE_SERVICE_ACCOUNT_KEY is not configured.");
    return null;
  }

  try {
    if (!getApps().length) {
      initializeApp({
        credential: cert(JSON.parse(serviceAccount)),
      });
    }
    // Read the database ID from the config file
    let databaseId = undefined;
    try {
      const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
      const configData = fs.readFileSync(configPath, 'utf8');
      const config = JSON.parse(configData);
      databaseId = config.firestoreDatabaseId;
    } catch (e) {
      console.warn("Could not load firebase-applet-config.json");
    }
    db = getFirestore(databaseId);
    return db;
  } catch (error) {
    console.error("Failed to initialize Firebase Admin:", error);
    return null;
  }
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;
  const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY;

  const isMutualFund = (symbol: string) => {
    return symbol.length === 5 && symbol.toUpperCase().endsWith('X');
  };

  async function fetchGoogleFinanceMutualFund(symbol: string): Promise<number | null> {
    try {
      const url = `https://www.google.com/finance/quote/${symbol}:MUTF`;
      const response = await nodeFetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } });
      if (response.ok) {
        const html = await response.text();
        const match = html.match(/data-last-price="([0-9\.]+)"/);
        if (match && match[1]) {
          return parseFloat(match[1]);
        }
      }
    } catch (e) {
      console.error(`Google Finance fetch failed for ${symbol}:`, e);
    }
    return null;
  }

  function getMockPrice(symbol: string): number {
    const FALLBACK: Record<string, number> = { 
      VTIAX: 35.85, 
      VXUS: 65.20, 
      VEA: 54.10, 
      VTSAX: 132.45, 
      VTTSX: 28.15, 
      FZROX: 20.30 
    };
    return FALLBACK[symbol] || 100.0;
  }

  function normalizeTicker(symbol: string): string {
    let normalized = symbol.toUpperCase().trim();
    if (normalized === 'BRKB' || normalized === 'BRK.B' || normalized === 'BRK B') return 'BRK-B';
    if (normalized === 'BRKA' || normalized === 'BRK.A' || normalized === 'BRK A') return 'BRK-A';
    if (normalized === 'BFB' || normalized === 'BF.B' || normalized === 'BF B') return 'BF-B';
    if (normalized === 'BFA' || normalized === 'BF.A' || normalized === 'BF A') return 'BF-A';
    return normalized.replace(/[\.\s]/g, '-');
  }

  app.get("/api/debug", async (req, res) => {
    try {
      const db = getDb();
      if (!db) return res.status(500).json({ error: "No DB" });
      const users = await db.collection('users').get();
      const user = users.docs.find(u => u.data().email?.toLowerCase() === 'gomezviolinist@gmail.com');
      if (!user) return res.json({ error: "Not found" });
      const assets = await db.collection('users').doc(user.id).collection('assets').get();
      res.json(assets.docs.map(d => ({id: d.id, ...d.data()})));
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Request logger
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
  });

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString(), env: process.env.NODE_ENV });
  });

  app.all("/api/prices", express.json(), async (req, res) => {
    let tickers = req.body?.tickers as string;
    let clearCache = req.body?.clearCache === true;
    
    if (req.method === 'GET') {
      tickers = req.query.tickers as string;
      clearCache = req.query.clearCache === 'true';
    }

    if (!tickers) {
      return res.status(400).json({ error: "Tickers are required" });
    }

    try {
      const tickerList = Array.from(new Set(tickers.split(',').map(t => normalizeTicker(t))));
      console.log(`Fetching unique prices for: ${tickerList.join(', ')}`);
      
      const db = getDb();
      if (db && clearCache) {
        console.log(`Clearing cache for: ${tickerList.join(', ')}`);
        const batch = db.batch();
        for (const symbol of tickerList) {
          batch.delete(db.collection('prices').doc(symbol));
        }
        await batch.commit();
      }
      
      const results: { symbol: string; price: number | null }[] = await Promise.all(
        tickerList.map(async (symbol) => {
          let price: number | null = null;
          let stalePrice: number | null = null;

          // 1. Check Firestore for cached price (15 min fresh) or stale fallback
          if (db) {
            try {
              const docRef = db.collection('prices').doc(symbol);
              const doc = await docRef.get();
              if (doc.exists) {
                const data = doc.data();
                if (data && data.price) {
                  // If it's less than 15 minutes old, use it immediately
                  if (Date.now() - new Date(data.updatedAt).getTime() < 900000) {
                    console.log(`[${new Date().toISOString()}] Using fresh Firestore price for: ${symbol}`);
                    return { symbol, price: data.price };
                  }
                  stalePrice = data.price;
                }
              }
            } catch (e) {
              console.error(`Error fetching from Firestore for ${symbol}:`, e);
            }
          }

          // 2. Try live fetch if not fresh in Firestore
          console.log(`[${new Date().toISOString()}] Attempting live fetch for: ${symbol}`);
          price = await fetchLivePrice(symbol, FINNHUB_API_KEY);

          // 3. Use stale price as fallback if live fetch fails
          if ((!price || price === 0) && stalePrice) {
            console.log(`[${new Date().toISOString()}] Live fetch failed for ${symbol}, using stale price: ${stalePrice}`);
            price = stalePrice;
          }

          // 4. Update Firestore
          if (price && !isNaN(price) && price !== 0) {
            if (db) {
              try {
                await db.collection('prices').doc(symbol).set({
                  symbol,
                  price,
                  date: new Date().toISOString().split('T')[0],
                  updatedAt: new Date().toISOString()
                });
              } catch (e) {
                console.error(`Error saving to Firestore for ${symbol}:`, e);
              }
            }
            return { symbol, price };
          } else {
            // Final fallback to mock ONLY for common tickers
            const mock = getMockPrice(symbol);
            if (mock !== 100.0) {
              console.warn(`[${new Date().toISOString()}] No price found for ${symbol}, using specific mock`);
              return { symbol, price: mock };
            } else {
              console.warn(`[${new Date().toISOString()}] No price found or mock available for ${symbol}`);
              return { symbol, price: null };
            }
          }
        })
      );
      
      const priceMap = results.reduce((acc, curr) => {
        if (curr.price !== null) {
          acc[curr.symbol] = curr.price;
        }
        return acc;
      }, {} as Record<string, number>);

      res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
      res.json(priceMap);
    } catch (error) {
      console.error("Failed to fetch prices:", error);
      res.status(500).json({ error: "Failed to fetch prices" });
    }
  });

  async function fetchLivePrice(symbol: string, finnhubKey?: string): Promise<number | null> {
    let price: number | null = null;
    
    // We try Yahoo Finance first for all symbols
    try {
      const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
      };
      
      const endpoints = [
        `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=5d`,
        `https://query2.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=5d`,
        `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbol}`
      ];
      
      for (const url of endpoints) {
        try {
          const response = await nodeFetch(url, { headers });
          if (response.ok) {
            const data: any = await response.json();
            if (url.includes('chart')) {
              const result = data?.chart?.result?.[0];
              if (result && result.meta) {
                  price = result.meta.regularMarketPrice || result.meta.previousClose;
                  if ((!price || price === 0) && result.indicators?.quote?.[0]?.close) {
                      const closePrices = result.indicators.quote[0].close;
                      for (let i = closePrices.length - 1; i >= 0; i--) {
                          if (closePrices[i] !== null && !isNaN(closePrices[i])) {
                              price = closePrices[i];
                              break;
                          }
                      }
                  }
              }
            } else {
              const result = data?.quoteResponse?.result?.[0];
              price = result?.regularMarketPrice || result?.previousClose || result?.bid || result?.ask || result?.netAssetValue;
            }
            if (price && price > 0) return price;
          }
        } catch (e) {
          // Continue to next endpoint
        }
      }
    } catch (err) {
      console.error(`Yahoo fetch failed for ${symbol}:`, err);
    }
    
    // Fallback to Google Finance
    const gfPrice = await fetchGoogleFinanceMutualFund(symbol);
    if (gfPrice) return gfPrice;
    
    // Fallback to Finnhub
    if (finnhubKey && !isMutualFund(symbol)) {
      try {
        await new Promise(resolve => setTimeout(resolve, 500));
        const response = await nodeFetch(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${finnhubKey}`);
        if (response.ok) {
          const data: any = await response.json();
          const p = parseFloat(data?.["c"]);
          if (p && p > 0) return p;
        }
      } catch (e) {
        // ignore
      }
    }
    
    return null;
  }


  app.post("/api/ticker-info", express.json(), async (req, res) => {
    const rawSymbol = (req.body.symbol as string)?.toUpperCase();
    if (!rawSymbol) return res.status(400).json({ error: "Symbol is required" });

    const symbol = normalizeTicker(rawSymbol);

    try {
      console.log(`[${new Date().toISOString()}] Fetching info for: ${symbol}`);
      const response = await nodeFetch(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`);
      if (response.ok) {
        const data: any = await response.json();
        const meta = data?.chart?.result?.[0]?.meta;
        if (meta) {
          // Identify type based on instrumentType or other fields
          let type: string = 'Domestic Stock';
          const instrumentType = meta.instrumentType;
          
          if (instrumentType === 'CRYPTOCURRENCY') {
            type = 'Crypto';
          } else if (symbol === 'GLD' || symbol === 'IAU' || symbol === 'SGOL' || symbol === 'OUNZ' || symbol === 'BAR') {
            type = 'Gold';
          } else if (symbol === 'BND' || symbol === 'AGG' || symbol === 'TLT' || symbol === 'IEF' || symbol === 'SHY' || symbol === 'LQD' || symbol === 'HYG' || symbol === 'VCIT' || symbol === 'VCSH' || symbol === 'BNDX') {
            type = 'Bonds';
          } else if (instrumentType === 'MUTUALFUND') {
            // Very basic heuristic: if it has 'int' or 'global' in name, maybe international
            const name = (meta.longName || meta.shortName || '').toLowerCase();
            if (name.includes('int') || name.includes('global') || name.includes('emerging')) {
              type = 'International Stock';
            } else if (name.includes('bond')) {
              type = 'Bonds';
            } else {
              type = 'Domestic Stock';
            }
          } else if (instrumentType === 'ETF') {
            const name = (meta.longName || meta.shortName || '').toLowerCase();
            if (name.includes('int') || name.includes('global') || name.includes('emerging') || name.includes('ex-us')) {
              type = 'International Stock';
            } else if (name.includes('bond') || name.includes('treasury')) {
              type = 'Bonds';
            } else {
              type = 'Domestic Stock';
            }
          }
          
          res.json({
            symbol,
            name: meta.longName || meta.shortName || symbol,
            price: meta.regularMarketPrice || meta.previousClose || null,
            type: type
          });
          return;
        }
      }
      res.status(404).json({ error: "Ticker not found" });
    } catch (error) {
      console.error("Failed to fetch ticker info:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

          app.all('/api/cron/sync', async (req, res) => {
    try {
      if (req.method !== 'GET' && req.method !== 'POST') {
        return res.status(405).json({ error: "Method not allowed" });
      }
      await runBackgroundSync();
      res.json({ success: true, message: "Background sync completed" });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  async function runBackgroundSync() {
    console.log(`[${new Date().toISOString()}] Starting global background sync for all users`);
    const db = getDb();
    if (!db) {
      console.error("No database connection available for background sync.");
      return;
    }

    try {
      const usersRef = await db.collection('users').get();
      for (const userDoc of usersRef.docs) {
        const userId = userDoc.id;
        const assetsRef = await db.collection('users').doc(userId).collection('assets').get();
        if (assetsRef.empty) continue;
        
        const assetsToUpdate = assetsRef.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter((a: any) => a.ticker && a.ticker !== 'CASH' && (a.qty > 0 || (a.type !== 'Private' && a.type !== 'Real Estate' && a.ticker !== 'Primary Res' && a.ticker !== 'Company Dtm')));

        if (assetsToUpdate.length === 0) continue;

        const tickers = Array.from(new Set(assetsToUpdate.map((a: any) => normalizeTicker(a.ticker)))) as string[];
        
        const priceMap: Record<string, number> = {};
        for(const symbol of tickers) {
           const price = await fetchLivePrice(symbol, FINNHUB_API_KEY);
           if (price && price > 0) {
              priceMap[symbol] = price;
              // Save to cache
              await db.collection('prices').doc(symbol).set({
                symbol,
                price,
                date: new Date().toISOString().split('T')[0],
                updatedAt: new Date().toISOString()
              }, { merge: true });
           } else {
              // Try fallback from cache
              const doc = await db.collection('prices').doc(symbol).get();
              if (doc.exists && doc.data()?.price) {
                 priceMap[symbol] = doc.data()?.price;
              } else {
                 const mock = getMockPrice(symbol);
                 if (mock !== 100.0) priceMap[symbol] = mock;
              }
           }
        }

        const batch = db.batch();
        let hasUpdates = false;

        for (const asset of assetsToUpdate) {
            const sym = normalizeTicker(asset.ticker);
            const livePrice = priceMap[sym];
            if (livePrice && livePrice !== asset.price) {
                const newTotal = (asset.qty || 0) * livePrice;
                const assetRef = db.collection('users').doc(userId).collection('assets').doc(asset.id);
                batch.update(assetRef, { price: livePrice, total: newTotal, updatedAt: new Date().toISOString() });
                hasUpdates = true;
            }
        }

        if (hasUpdates) {
           await batch.commit();
           console.log(`[${new Date().toISOString()}] Updated assets for user: ${userId}`);
        }
      }
      console.log(`[${new Date().toISOString()}] Background sync completed for all users`);
    } catch (e) {
      console.error("Background sync failed:", e);
    }
  }

  // Run the background sync every hour (3600000 ms) automatically while the server is alive
  setInterval(runBackgroundSync, 3600000);

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[${new Date().toISOString()}] Server running on http://0.0.0.0:${PORT}`);
    console.log(`[${new Date().toISOString()}] Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}

startServer();
