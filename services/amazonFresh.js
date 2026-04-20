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

async function getAmazonFreshPrice(query) {
  const b = await getBrowser();
  const page = await b.newPage();

  try {
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36"
    );

    await page.setViewport({ width: 1366, height: 768 });

    const url =
      "https://www.amazon.in/s?i=amazonfresh&k=" +
      encodeURIComponent(query);

    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    // ⏳ Wait properly
    await page.waitForTimeout(4000);

    // 📜 Scroll more (important for Amazon)
    await page.evaluate(() => {
      window.scrollBy(0, 1000);
    });

    await page.waitForTimeout(2000);

    // 🔥 Extract multiple prices → pick first valid
    const price = await page.evaluate(() => {
      const prices = document.querySelectorAll(".a-price");

      for (let p of prices) {
        const text = p.innerText;

        if (text && text.includes("₹")) {
          const match = text.match(/₹[\d,]+/);

          if (match) {
            const num = parseInt(match[0].replace(/[^\d]/g, ""), 10);

            if (num > 0) {
              return match[0];
            }
          }
        }
      }

      return "N/A";
    });

    return price;
  } catch (err) {
    console.error("Amazon Fresh error:", err.message);
    return "N/A";
  } finally {
    await page.close();
  }
}

module.exports = { getAmazonFreshPrice };