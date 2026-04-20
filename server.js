// app.get("/compare", (req, res) => {
//   res.json({
//     Amazon: "₹52",
//     Flipkart: "₹48",
//     Blinkit: "₹55",
//     cheapest: "Flipkart",
//     timestamp: new Date().toISOString(),
//     fromCache: false,
//   });
// });


const express = require("express");
const cors = require("cors");
const NodeCache = require("node-cache");
const { getAmazonPrice } = require("./services/amazon");
const { getFlipkartPrice } = require("./services/flipkart");
const { getBlinkitPrice } = require("./services/blinkit");
const { getZeptoPrice } = require("./services/zepto");
const { getAmazonFreshPrice } = require("./services/amazonFresh");

const app = express();
const cache = new NodeCache({ stdTTL: 90 });

app.use(cors({ origin: "*" }));
app.use(express.json());

app.get("/compare", async (req, res) => {
  const query = req.query.q?.trim();
  if (!query) {
    return res.status(400).json({ error: "Query param 'q' is required" });
  }

  const key = query.toLowerCase();
  const cached = cache.get(key);
  if (cached) return res.json({ ...cached, fromCache: true });

  const timeout = (p, ms = 20000) =>
    Promise.race([
      p,
      new Promise((r) => setTimeout(() => r("N/A"), ms)),
    ]).catch(() => "N/A");

  // ✅ Parallel calls
  const [Amazon, Flipkart, Blinkit, Zepto, AmazonFresh] = await Promise.all([
    timeout(getAmazonPrice(query)),
    timeout(getFlipkartPrice(query)),
    timeout(getBlinkitPrice(query)),
    timeout(getZeptoPrice(query)),
    timeout(getAmazonFreshPrice(query)),
  ]);

  let cheapest = null;
  let min = Infinity;

  for (const [platform, price] of Object.entries({ Amazon, Flipkart, Blinkit, Zepto, AmazonFresh })) {
    if (price !== "N/A") {
      const num = parseInt(price.replace(/[^\d]/g, ""), 10);
      if (!isNaN(num) && num < min) {
        min = num;
        cheapest = platform;
      }
    }
  }

  const result = {
    Amazon,
    Flipkart,
    Blinkit,
    Zepto,
    AmazonFresh,
    cheapest,
    timestamp: new Date().toISOString(),
    fromCache: false,
  };

  cache.set(key, result);
  res.json(result);
});

app.get("/health", (_, res) => res.json({ status: "ok" }));

app.listen(5000, () =>
  console.log("API running at http://localhost:5000")
);