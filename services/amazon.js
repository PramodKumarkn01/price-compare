const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");

puppeteer.use(StealthPlugin());

let browser = null;

async function getBrowser() {
  if (!browser || !browser.isConnected()) {
    browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
  }
  return browser;
}

async function getAmazonPrice(query) {
  const b = await getBrowser();
  const page = await b.newPage();

  try {
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36"
    );

    await page.setViewport({ width: 1366, height: 768 });

    const url =
      "https://www.amazon.in/s?k=" + encodeURIComponent(query);

    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    // ✅ Wait for price on listing page
    await page.waitForSelector(".a-price .a-offscreen", {
      timeout: 15000,
    });

    // ✅ Extract first visible price
    const price = await page.evaluate(() => {
      const prices = document.querySelectorAll(".a-price .a-offscreen");
      for (let el of prices) {
        if (el.innerText) return el.innerText;
      }
      return "N/A";
    });

    return price || "N/A";
  } catch (err) {
    console.error("Amazon error:", err.message);

    try {
      await page.screenshot({ path: "amazon-error.png" });
    } catch {}

    return "N/A";
  } finally {
    await page.close();
  }
}

module.exports = { getAmazonPrice };