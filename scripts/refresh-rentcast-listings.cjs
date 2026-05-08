const fs = require("fs");
const path = require("path");
const { refreshCachedListings, CACHE_PATH } = require("../lib/rentcastListings.cjs");

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      return;
    }

    const [rawKey, ...rawValueParts] = trimmed.split("=");
    const key = rawKey.trim();
    const value = rawValueParts.join("=").trim().replace(/^["']|["']$/g, "");
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  });
}

loadEnvFile(path.join(__dirname, "..", ".env"));
loadEnvFile(path.join(__dirname, "..", "server", ".env"));

async function main() {
  const listings = await refreshCachedListings();
  console.log(`Saved ${listings.length} RentCast listing(s) to ${CACHE_PATH}`);
}

main().catch((error) => {
  console.error("Could not refresh RentCast listings.");
  console.error(error.message);
  process.exit(1);
});
