const axios = require("axios");

async function getFlipkartPrice(query) {
  try {
    const url = `https://www.flipkart.com/search?q=${encodeURIComponent(query)}`;

    const res = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0",
      },
    });

    const html = res.data;

    // Extract price using regex (fallback approach)
    const match = html.match(/₹[\d,]+/);

    return match ? match[0] : "N/A";
  } catch (err) {
    console.error("Flipkart API error:", err.message);
    return "N/A";
  }
}

module.exports = { getFlipkartPrice };