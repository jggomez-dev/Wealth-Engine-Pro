import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;
  const ALPHA_VANTAGE_API_KEY = process.env.ALPHA_VANTAGE_API_KEY;
  const priceCache = new Map<string, { price: number; timestamp: number }>();
  const CACHE_DURATION = 3600000; // 1 hour

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
    if (!ALPHA_VANTAGE_API_KEY) {
      return res.status(500).json({ error: "Alpha Vantage API key not configured" });
    }

    try {
      const tickerList = Array.from(new Set(tickers.split(',').map(t => t.trim().toUpperCase())));
      console.log(`Fetching unique prices for: ${tickerList.join(', ')}`);
      
      const results: { symbol: string; price: number | null }[] = [];
      for (const symbol of tickerList) {
        // Check cache first
        const cached = priceCache.get(symbol);
        if (cached && (Date.now() - cached.timestamp < CACHE_DURATION)) {
          console.log(`[${new Date().toISOString()}] Returning cached price for: ${symbol}`);
          results.push({ symbol, price: cached.price });
          continue;
        }

        try {
          // Delay each request by 2 seconds to stay under the 1 request/sec limit
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          console.log(`[${new Date().toISOString()}] Requesting Alpha Vantage for: ${symbol}`);
          const response = await fetch(`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${ALPHA_VANTAGE_API_KEY}`);
          
          if (!response.ok) {
            console.error(`[${new Date().toISOString()}] Alpha Vantage HTTP error for ${symbol}: ${response.status}`);
            results.push({ symbol, price: null });
            continue;
          }

          const data = await response.json();
          
          const price = parseFloat(data?.["Global Quote"]?.["05. price"]);
          
          if (!isNaN(price)) {
            priceCache.set(symbol, { price, timestamp: Date.now() });
            results.push({ symbol, price });
          } else {
            console.warn(`[${new Date().toISOString()}] No price found for ${symbol} in response`);
            results.push({ symbol, price: null });
          }
        } catch (e) {
          console.error(`[${new Date().toISOString()}] Error fetching price for ${symbol}:`, e);
          results.push({ symbol, price: null });
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
