import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;
  const ALPHA_VANTAGE_API_KEY = process.env.ALPHA_VANTAGE_API_KEY;

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
      const tickerList = tickers.split(',').map(t => t.trim().toUpperCase());
      console.log(`Fetching prices for: ${tickerList.join(', ')}`);
      
      const results = await Promise.all(
        tickerList.map(async (symbol, index): Promise<{ symbol: string; price: number | null }> => {
          try {
            // Delay each request by 1.5 seconds to stay under the 1 request/sec limit
            await new Promise(resolve => setTimeout(resolve, index * 1500));
            
            console.log(`[${new Date().toISOString()}] Requesting Alpha Vantage for: ${symbol}`);
            const response = await fetch(`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${ALPHA_VANTAGE_API_KEY}`);
            
            if (!response.ok) {
              console.error(`[${new Date().toISOString()}] Alpha Vantage HTTP error for ${symbol}: ${response.status}`);
              return { symbol, price: null };
            }

            const data = await response.json();
            console.log(`[${new Date().toISOString()}] Alpha Vantage response for ${symbol}:`, JSON.stringify(data));
            
            const price = parseFloat(data?.["Global Quote"]?.["05. price"]);
            
            if (!isNaN(price)) {
              return { symbol, price };
            }
            console.warn(`[${new Date().toISOString()}] No price found for ${symbol} in response`);
            return { symbol, price: null };
          } catch (e) {
            console.error(`[${new Date().toISOString()}] Error fetching price for ${symbol}:`, e);
            return { symbol, price: null };
          }
        })
      );
      
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
