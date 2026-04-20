const axios = require("axios");
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");

puppeteer.use(StealthPlugin());

let browser = null;

// 🔹 Reuse browser instance
async function getBrowser() {
  if (!browser || !browser.isConnected()) {
    browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
  }
  return browser;
}

//
// ✅ METHOD 1: Blinkit API (FIXED ₹0 ISSUE)
//
async function fetchViaAPI(query) {
  try {
    const res = await axios.get("https://blinkit.com/v1/search", {
      params: {
        q: query,
        lat: "12.9719", // Vijayanagar
        lng: "77.5346",
      },
      headers: {
        "User-Agent": "Mozilla/5.0",
        Accept: "application/json",
        Origin: "https://blinkit.com",
        Referer: "https://blinkit.com/",
      },
      timeout: 10000,
    });

    const products =
      res.data?.products ||
      res.data?.response?.products ||
      [];

    // 🔥 FIX: ignore ₹0 and invalid prices
    for (const p of products) {
      const price =
        p?.price ||
        p?.selling_price ||
        p?.mrp;

      if (typeof price === "number" && price > 0) {
        return "₹" + Math.round(price);
      }
    }

    return null;
  } catch (err) {
    console.log("Blinkit API failed");
    return null;
  }
}

//
// ✅ METHOD 2: Scraping (IMPROVED)
//
async function fetchViaScrape(query) {
  const b = await getBrowser();
  const page = await b.newPage();

  try {
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120"
    );

    const url =
      "https://blinkit.com/s/?q=" + encodeURIComponent(query);

    await page.goto(url, {
      waitUntil: "networkidle2",
      timeout: 30000,
    });

    // ⏳ wait for dynamic content
    await new Promise((r) => setTimeout(r, 5000));

    // 📜 scroll to load products
    await page.evaluate(() => window.scrollBy(0, 800));

    // 🔥 Better extraction (avoid random ₹ text)
    const price = await page.evaluate(() => {
      const elements = document.querySelectorAll("span, div");

      for (let el of elements) {
        const text = el.innerText;

        if (text && text.includes("₹")) {
          const match = text.match(/₹\s?[\d,]+/);

          if (match) {
            const clean = match[0].replace(/[^\d]/g, "");
            const num = parseInt(clean, 10);

            if (num > 0) {
              return "₹" + num;
            }
          }
        }
      }

      return "N/A";
    });

    return price;
  } catch (err) {
    console.error("[Blinkit SCRAPE ERROR]", err.message);

    try {
      await page.screenshot({ path: "blinkit-error.png" });
    } catch {}

    return "N/A";
  } finally {
    await page.close();
  }
}

//
// ✅ MAIN FUNCTION
//
async function getBlinkitPrice(query) {
  // 🔥 Try API first
  const apiPrice = await fetchViaAPI(query);

  if (apiPrice && apiPrice !== "₹0") {
    return apiPrice;
  }

  // ⏳ delay before fallback
  await new Promise((r) => setTimeout(r, 2000));

  // 🔁 fallback
  const scrapePrice = await fetchViaScrape(query);

  return scrapePrice || "N/A";
}

//
// ✅ EXPORT
//
module.exports = { getBlinkitPrice };