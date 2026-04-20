const express = require("express");
const cors = require("cors");
const NodeCache = require("node-cache");

const { getAmazonPrice } = require("./services/amazon");
const { getFlipkartPrice } = require("./services/flipkart");
const { getBlinkitPrice } = require("./services/blinkit");
const { getZeptoPrice } = require("./services/zepto");
const { getAmazonFreshPrice } = require("./services/amazonFresh");

const app = express();

// ✅ IMPORTANT for Render
const PORT = process.env.PORT || 5000;

// ✅ Cache (90 seconds)
const cache = new NodeCache({ stdTTL: 90 });

// ✅ Middleware
app.use(cors({ origin: "*" }));
app.use(express.json());

/**
 * Utility: Add timeout to scraping
 */
const timeout = (promise, ms = 20000) =>
  Promise.race([
    promise,
    new Promise((resolve) => setTimeout(() => resolve("N/A"), ms)),
  ]).catch(() => "N/A");

/**
 * API: Compare prices
 */
app.get("/compare", async (req, res) => {
  try {
    const query = req.query.q?.trim();

    if (!query) {
      return res.status(400).json({ error: "Query param 'q' is required" });
    }

    const key = query.toLowerCase();

    // ✅ Check cache
    const cached = cache.get(key);
    if (cached) {
      return res.json({ ...cached, fromCache: true });
    }

    // ✅ Run all scrapers in parallel
    const [Amazon, Flipkart, Blinkit, Zepto, AmazonFresh] =
      await Promise.all([
        timeout(getAmazonPrice(query)),
        timeout(getFlipkartPrice(query)),
        timeout(getBlinkitPrice(query)),
        timeout(getZeptoPrice(query)),
        timeout(getAmazonFreshPrice(query)),
      ]);

    // ✅ Find cheapest
    let cheapest = null;
    let min = Infinity;

    const prices = { Amazon, Flipkart, Blinkit, Zepto, AmazonFresh };

    for (const [platform, price] of Object.entries(prices)) {
      if (price && price !== "N/A") {
        const num = parseInt(price.replace(/[^\d]/g, ""), 10);

        if (!isNaN(num) && num < min) {
          min = num;
          cheapest = platform;
        }
      }
    }

    const result = {
      ...prices,
      cheapest,
      timestamp: new Date().toISOString(),
      fromCache: false,
    };

    // ✅ Store in cache
    cache.set(key, result);

    res.json(result);
  } catch (error) {
    console.error("Error in /compare:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * Health check route (VERY IMPORTANT for Render)
 */
app.get("/", (req, res) => {
  res.send("API is running 🚀");
});

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

/**
 * Start server
 */
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});