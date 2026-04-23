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

  // Request logger
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
  });

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString(), env: process.env.NODE_ENV });
  });

  app.get("/api/prices", async (req, res) => {
    const tickers = req.query.tickers as string;
    const clearCache = req.query.clearCache === 'true';
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
      
      const results: { symbol: string; price: number | null }[] = [];
      for (const symbol of tickerList) {
        // Check Firestore first
        const db = getDb();
        if (db) {
          try {
            const docRef = db.collection('prices').doc(symbol);
            const doc = await docRef.get();
            if (doc.exists) {
              const data = doc.data();
              // Cache prices for 15 minutes (900000 ms) instead of 24 hours
              if (data && (Date.now() - new Date(data.updatedAt).getTime() < 900000)) {
                console.log(`[${new Date().toISOString()}] Returning Firestore price for: ${symbol}`);
                results.push({ symbol, price: data.price });
                continue;
              }
            }
          } catch (e) {
            console.error(`Error fetching from Firestore for ${symbol}:`, e);
          }
        }

        try {
          let price: number | null = null;
          
          // We try Yahoo Finance for all symbols (stocks, ETFs, mutual funds) since it doesn't require an API key
          if (true) {
            console.log(`[${new Date().toISOString()}] Requesting price for: ${symbol}`);
            try {
              const headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json',
                'Accept-Language': 'en-US,en;q=0.9',
              };
              
                // Mutual funds often have weird daily reporting schedules (end of trading day only).
              // We try a few different yahoo finance APIs to find the latest valid price.
              const endpoints = [
                `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=5d`,
                `https://query2.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=5d`,
                `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbol}`
              ];
              
              for (const url of endpoints) {
                const response = await nodeFetch(url, { headers });
                if (response.ok) {
                  const data: any = await response.json();
                  if (url.includes('chart')) {
                    const result = data?.chart?.result?.[0];
                    if (result && result.meta) {
                        price = result.meta.regularMarketPrice || result.meta.previousClose;
                        
                        // If meta price is missing or zero, try to extract from the most recent closing price array
                        if ((!price || price === 0) && result.indicators?.quote?.[0]?.close) {
                            const closePrices = result.indicators.quote[0].close;
                            // Find the last non-null value in the array
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
                    // Also check for 'netAssetValue' which is often used for mutual funds instead of regularMarketPrice
                    price = result?.regularMarketPrice || result?.previousClose || result?.bid || result?.ask || result?.netAssetValue;
                  }
                  if (price && price > 0) break;
                } else {
                  if (response.status !== 404 && response.status !== 401) {
                    console.warn(`Yahoo endpoint failed (${response.status}): ${url}`);
                  }
                }
              }
              if (price && price !== 0) {
                console.log(`[${new Date().toISOString()}] Price response for ${symbol}: ${price}`);
              }
            } catch (err) {
              console.error(`Asset fetch failed for ${symbol}:`, err);
            }
          }

          if ((!price || price === 0) && isMutualFund(symbol)) {
            console.log(`[${new Date().toISOString()}] Requesting Google Finance for: ${symbol}`);
            const gfPrice = await fetchGoogleFinanceMutualFund(symbol);
            if (gfPrice) price = gfPrice;
          }
          
          // Fallback to finnhub for remaining non-mutual funds if the key is available
          // We DO NOT use Finnhub for Mutual Funds because it returns stale/inaccurate data
          if ((!price || price === 0) && FINNHUB_API_KEY && !isMutualFund(symbol)) {
            // Delay each request by 1 second to stay under the Finnhub free tier limit
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            console.log(`[${new Date().toISOString()}] Requesting Finnhub for: ${symbol}`);
            const response = await fetch(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FINNHUB_API_KEY}`);
            
            if (response.ok) {
              const data = await response.json();
              price = parseFloat(data?.["c"]);
            }
          }
          
          if (price && !isNaN(price) && price !== 0) {
            // Save to Firestore
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
            results.push({ symbol, price });
          } else {
            console.warn(`[${new Date().toISOString()}] No price found for ${symbol}, using mock`);
            results.push({ symbol, price: getMockPrice(symbol) });
          }
        } catch (e) {
          console.error(`[${new Date().toISOString()}] Error fetching price for ${symbol}:`, e);
          results.push({ symbol, price: getMockPrice(symbol) });
        }
      }
      
      const priceMap = results.reduce((acc, curr) => {
        if (curr.price !== null) {
          acc[curr.symbol] = curr.price;
        }
        return acc;
      }, {} as Record<string, number>);

      res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
      res.set('Surrogate-Control', 'no-store');
      res.json(priceMap);
    } catch (error) {
      console.error("Failed to fetch prices:", error);
      res.status(500).json({ error: "Failed to fetch prices" });
    }
  });

  app.get("/api/ticker-info", async (req, res) => {
    const rawSymbol = (req.query.symbol as string)?.toUpperCase();
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
