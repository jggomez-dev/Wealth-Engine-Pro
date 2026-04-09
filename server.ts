import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from 'url';
import yahooFinance from 'yahoo-finance2';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // Request logger
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
  });

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  app.get("/api/test-finance", async (req, res) => {
    try {
      const symbol = 'AAPL';
      const quote = await yahooFinance.quote(symbol) as any;
      res.json({ success: true, symbol, price: quote.regularMarketPrice });
    } catch (error: any) {
      res.status(500).json({ 
        success: false, 
        error: error.message, 
        status: error?.response?.status,
        data: error?.response?.data 
      });
    }
  });

  app.get("/api/prices", async (req, res) => {
    const tickers = req.query.tickers as string;
    if (!tickers) {
      return res.status(400).json({ error: "Tickers are required" });
    }

    try {
      const tickerList = tickers.split(',').map(t => t.trim().toUpperCase());
      console.log(`[${new Date().toISOString()}] Fetching prices for: ${tickerList.join(', ')}`);
      
      const results = await Promise.all(
        tickerList.map(async (symbol): Promise<{ symbol: string; price: number | null }> => {
          try {
            // Try direct fetch to Yahoo API first (often bypasses library issues and blocks)
            const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbol}`;
            const response = await fetch(url, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json',
                'Cache-Control': 'no-cache'
              }
            });

            if (response.ok) {
              const data: any = await response.json();
              const result = data?.quoteResponse?.result?.[0];
              const price = result?.regularMarketPrice || result?.postMarketPrice || result?.preMarketPrice;
              if (price) {
                console.log(`[${new Date().toISOString()}] Direct fetch success for ${symbol}: ${price}`);
                return { symbol, price };
              }
            } else {
              console.warn(`[${new Date().toISOString()}] Direct fetch failed for ${symbol} (Status: ${response.status})`);
            }

            // Fallback to the library if direct fetch fails
            const quote = await yahooFinance.quote(symbol, {}, { 
              validateResult: false,
              fetchOptions: {
                headers: {
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
              }
            }) as any;
            
            const price = quote?.regularMarketPrice || quote?.postMarketPrice || quote?.preMarketPrice;
            
            if (price) {
              return { symbol, price };
            }

            const summary = await yahooFinance.quoteSummary(symbol, { modules: ['price'] }) as any;
            return { symbol, price: summary?.price?.regularMarketPrice || null };
          } catch (e: any) {
            const errorMessage = e instanceof Error ? e.message : String(e);
            console.error(`[${new Date().toISOString()}] Error fetching price for ${symbol}:`, errorMessage);
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

      console.log(`Successfully fetched ${Object.keys(priceMap).length} prices`);
      res.json(priceMap);
    } catch (error) {
      console.error("Failed to fetch prices:", error);
      res.status(500).json({ 
        error: "Failed to fetch prices",
        details: error instanceof Error ? error.message : String(error)
      });
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
    const distPath = path.resolve(__dirname, 'dist');
    console.log(`Serving static files from: ${distPath}`);
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
