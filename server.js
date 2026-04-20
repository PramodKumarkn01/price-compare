const express = require("express");
const cors = require("cors");
const NodeCache = require("node-cache");

const { getAmazonPrice } = require("./services/amazon");
const { getFlipkartPrice } = require("./services/flipkart");
const { getBlinkitPrice } = require("./services/blinkit");
const { getZeptoPrice } = require("./services/zepto");
const { getAmazonFreshPrice } = require("./services/amazonFresh");

const app = express();
const PORT = process.env.PORT || 5000;

const cache = new NodeCache({ stdTTL: 120 });

app.use(cors({ origin: "*" }));
app.use(express.json());

// Utility timeout
const timeout = (promise, ms = 25000) =>
  Promise.race([
    promise,
    new Promise((resolve) => setTimeout(() => resolve("N/A"), ms)),
  ]).catch(() => "N/A");

app.get("/", (req, res) => {
  res.send("API is running 🚀");
});

app.get("/compare", async (req, res) => {
  try {
    const query = req.query.q?.trim();
    if (!query) {
      return res.status(400).json({ error: "Query required" });
    }

    const key = query.toLowerCase();

    const cached = cache.get(key);
    if (cached) {
      return res.json({ ...cached, fromCache: true });
    }

    const [Amazon, Flipkart, Blinkit, Zepto, AmazonFresh] =
      await Promise.all([
        timeout(getAmazonPrice(query)),
        timeout(getFlipkartPrice(query)),
        timeout(getBlinkitPrice(query)),
        timeout(getZeptoPrice(query)),
        timeout(getAmazonFreshPrice(query)),
      ]);

    const prices = { Amazon, Flipkart, Blinkit, Zepto, AmazonFresh };

    let cheapest = null;
    let min = Infinity;

    for (const [platform, price] of Object.entries(prices)) {
      if (price !== "N/A") {
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

    cache.set(key, result);

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal error" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});