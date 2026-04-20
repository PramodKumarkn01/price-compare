const axios = require("axios");
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");

puppeteer.use(StealthPlugin());

let browser = null;

// 🔹 reuse browser
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
// ✅ METHOD 1: Try API (may fail sometimes)
//
async function fetchViaAPI(query) {
  try {
    const res = await axios.get(
      "https://api.zepto.co.in/v1/search",
      {
        params: {
          q: query,
        },
        headers: {
          "User-Agent": "Mozilla/5.0",
          "Accept": "application/json",
        },
        timeout: 8000,
      }
    );

    const products = res.data?.products || [];

    for (const p of products) {
      const price = p?.price || p?.selling_price;
      if (price) return "₹" + Math.round(price);
    }

    return null;
  } catch (err) {
    console.log("Zepto API failed");
    return null;
  }
}

//
// ✅ METHOD 2: Scraping fallback
//
async function fetchViaScrape(query) {
  const b = await getBrowser();
  const page = await b.newPage();

  try {
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120"
    );

    const url =
      "https://www.zeptonow.com/search?query=" +
      encodeURIComponent(query);

    await page.goto(url, {
      waitUntil: "networkidle2",
      timeout: 30000,
    });

    // ⏳ wait for rendering
    await new Promise((r) => setTimeout(r, 5000));

    // 📜 scroll
    await page.evaluate(() => window.scrollBy(0, 800));

    // 🔍 extract price
    const price = await page.evaluate(() => {
      const elements = document.querySelectorAll("span, div");

      for (let el of elements) {
        const text = el.innerText;

        if (text && text.includes("₹")) {
          const match = text.match(/₹\s?[\d,]+/);
          if (match) {
            return match[0].replace(/\s/g, "");
          }
        }
      }

      return "N/A";
    });

    return price;
  } catch (err) {
    console.error("[Zepto SCRAPE ERROR]", err.message);

    try {
      await page.screenshot({ path: "zepto-error.png" });
    } catch {}

    return "N/A";
  } finally {
    await page.close();
  }
}

//
// ✅ MAIN FUNCTION
//
async function getZeptoPrice(query) {
  const apiPrice = await fetchViaAPI(query);

  if (apiPrice && apiPrice !== "₹0") {
    return apiPrice;
  }

  await new Promise((r) => setTimeout(r, 2000));

  return await fetchViaScrape(query);
}

//
// ✅ EXPORT
//
module.exports = { getZeptoPrice };