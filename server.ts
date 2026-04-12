import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import yahooFinance from 'yahoo-finance2';
const yf = new yahooFinance();

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

  const MUTUAL_FUNDS = ['VTIAX', 'VTSAX', 'VTTSX', 'FZROX'];

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
    if (!tickers) {
      return res.status(400).json({ error: "Tickers are required" });
    }

    try {
      const tickerList = Array.from(new Set(tickers.split(',').map(t => t.trim().toUpperCase())));
      console.log(`Fetching unique prices for: ${tickerList.join(', ')}`);
      
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
              if (data && (Date.now() - new Date(data.updatedAt).getTime() < 86400000)) {
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
          
          if (MUTUAL_FUNDS.includes(symbol)) {
            console.log(`[${new Date().toISOString()}] Requesting Yahoo Finance for mutual fund: ${symbol}`);
            const quote = await yf.quote(symbol);
            console.log(`[${new Date().toISOString()}] Yahoo Finance response for ${symbol}:`, JSON.stringify(quote));
            price = quote.regularMarketPrice || quote.previousClose || null;
          } else if (FINNHUB_API_KEY) {
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

      res.json(priceMap);
    } catch (error) {
      console.error("Failed to fetch prices:", error);
      res.status(500).json({ error: "Failed to fetch prices" });
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
