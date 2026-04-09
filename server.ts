import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance();

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

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
      const tickerList = tickers.split(',').map(t => t.trim().toUpperCase());
      console.log(`Fetching prices for: ${tickerList.join(', ')}`);
      
      const results = await Promise.all(
        tickerList.map(async (symbol): Promise<{ symbol: string; price: number | null }> => {
          try {
            const quote = await yahooFinance.quote(symbol, {}, { 
              validateResult: false,
              fetchOptions: {
                headers: {
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
              }
            }) as any;
            
            const price = quote?.regularMarketPrice || quote?.postMarketPrice || quote?.preMarketPrice || quote?.bid || quote?.ask;
            
            if (price) {
              return { symbol, price };
            }

            const summary = await yahooFinance.quoteSummary(symbol, { 
              modules: ['price'] 
            }, {
              fetchOptions: {
                headers: {
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
              }
            }) as any;
            const summaryPrice = summary?.price?.regularMarketPrice;
            return { symbol, price: summaryPrice || null };
          } catch (e) {
            console.error(`Error fetching price for ${symbol}:`, e);
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
