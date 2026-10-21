/**
 * seed-catalog.js — replace the product catalog with a large, realistic set
 * (~160 products across 8 categories) so ShopSphere looks like a real store.
 *
 * Run with:  npm run seed:catalog   (from the backend folder)
 *
 * This DELETES existing products and inserts a freshly generated catalog.
 * Orders are untouched (orders.items is a JSONB snapshot, not a FK), and the
 * generated search_vector column + GIN index are maintained automatically.
 */
require("dotenv").config();
const pool = require("../src/pool");

function makeId(prefix) {
  return prefix + Math.random().toString(36).slice(2, 9);
}
// Roughly how many products to generate per non-book category.
const PER_CAT = 68;
const rnd = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = (arr) => arr[rnd(0, arr.length - 1)];
const rating = () => Math.round((Math.random() * 1.2 + 3.7) * 10) / 10; // 3.7–4.9
const stock = () => rnd(0, 140);
// Price snapped to a "nice" number within a range.
function price(min, max) {
  const p = rnd(min, max);
  const step = p > 10000 ? 500 : p > 2000 ? 100 : 10;
  return Math.max(min, Math.round(p / step) * step - 1);
}

// Each spec: type, price range, brands, and description fragments.
const SPECS = {
  Electronics: {
    brands: ["Aurora", "Nebula", "Pixel", "Sonic", "Vortex", "Quantum", "Zenith", "Pulse", "Flux", "Nova"],
    types: [
      ["Wireless Headphones", 2499, 24999, "active noise cancellation, deep bass and all-day battery life"],
      ["True Wireless Earbuds", 1499, 19999, "crisp sound, snug fit and a pocket-size charging case"],
      ["Smart Watch", 2999, 32999, "an always-on AMOLED display, heart-rate tracking and 100+ sport modes"],
      ["Bluetooth Speaker", 1299, 14999, "360° room-filling sound, long playtime and waterproofing"],
      ["Mechanical Keyboard", 2999, 12999, "hot-swappable switches, per-key RGB and a satisfying tactile feel"],
      ["Wireless Mouse", 799, 7999, "a silent click, precise tracking and a rechargeable battery"],
      ["4K Monitor", 11999, 54999, "vivid colour accuracy, thin bezels and an ergonomic stand"],
      ["Mirrorless Camera", 39999, 149999, "a large sensor, 4K video and in-body stabilisation"],
      ["Action Camera", 8999, 39999, "rugged waterproof design and buttery-smooth stabilised 4K"],
      ["Power Bank", 999, 6999, "fast charging, high capacity and multiple ports"],
      ["Streaming Stick", 2999, 7999, "4K HDR streaming with a voice remote and Wi-Fi 6"],
      ["Gaming Controller", 2499, 9999, "low-latency wireless, textured grips and remappable buttons"],
      ["Tablet", 14999, 89999, "a laminated display, long battery and stylus support"],
      ["Soundbar", 6999, 44999, "cinematic surround, wireless subwoofer and HDMI eARC"],
      ["Fitness Band", 1499, 8999, "SpO2 and sleep tracking with a two-week battery"],
      ["Webcam", 1999, 12999, "sharp 1080p/4K video, autofocus and a privacy shutter"],
    ],
  },
  Fashion: {
    brands: ["Cloudstep", "Heritage", "Meridian", "Terra", "Cascade", "Urban", "Nomad", "Crest", "Atlas", "Vogue"],
    types: [
      ["Running Shoes", 1999, 12999, "ultra-light knit uppers and a responsive foam midsole"],
      ["Leather Backpack", 2499, 11999, "full-grain leather, a padded laptop sleeve and brass hardware"],
      ["Aviator Sunglasses", 999, 6999, "polarised UV400 lenses and a lightweight titanium frame"],
      ["Merino Wool Sweater", 1999, 7999, "breathable, temperature-regulating knit in a modern fit"],
      ["Waterproof Jacket", 2999, 13999, "a taped-seam shell, pit-zip venting and a packable hood"],
      ["Denim Jacket", 1999, 7999, "rigid selvedge denim with a timeless tailored cut"],
      ["Cotton T-Shirt", 499, 2499, "soft combed cotton with a clean, everyday fit"],
      ["Formal Shirt", 999, 4999, "wrinkle-resistant weave with mother-of-pearl buttons"],
      ["Chino Trousers", 1299, 5999, "stretch-cotton twill with a tailored straight leg"],
      ["Analog Watch", 2999, 24999, "a sapphire crystal, sweeping hands and a leather strap"],
      ["Leather Wallet", 699, 4999, "slim full-grain leather with RFID-blocking card slots"],
      ["Canvas Sneakers", 999, 4999, "classic vulcanised soles and breathable canvas"],
      ["Hooded Sweatshirt", 1299, 5999, "heavyweight loopback cotton with a cosy lined hood"],
      ["Silk Scarf", 899, 5999, "hand-rolled edges and a vivid printed design"],
      ["Leather Belt", 699, 3999, "full-grain leather with a brushed metal buckle"],
    ],
  },
  Home: {
    brands: ["Ember", "Lumen", "Verdant", "Nordic", "Hearth", "Sol", "Casa", "Haven", "Maple", "Terra"],
    types: [
      ["Pour-Over Coffee Set", 1299, 6999, "a hand-glazed ceramic dripper and server for the perfect brew"],
      ["Smart Desk Lamp", 1499, 7999, "tunable warm-to-cool light, wireless charging and touch dimming"],
      ["Indoor Plant Trio", 999, 3999, "low-maintenance air-purifying plants in matte stoneware pots"],
      ["Linen Duvet Set", 2999, 12999, "stonewashed pure-linen cover that softens with every wash"],
      ["Cast Iron Skillet", 1299, 4999, "a pre-seasoned pan for searing, baking and everything between"],
      ["Non-Stick Cookware Set", 1999, 11999, "even-heating pans with a durable scratch-resistant coating"],
      ["Scented Candle", 499, 2999, "a long-burning soy blend with notes of sandalwood and amber"],
      ["Air Purifier", 5999, 29999, "a true-HEPA filter, quiet operation and real-time air quality"],
      ["Robot Vacuum", 11999, 44999, "lidar mapping, strong suction and app-controlled cleaning"],
      ["Stainless Water Bottle", 499, 2999, "double-wall insulation that keeps drinks cold for 24 hours"],
      ["Knife Block Set", 1999, 9999, "high-carbon stainless blades with an ergonomic grip"],
      ["Throw Blanket", 999, 4999, "a chunky-knit cosy throw perfect for the sofa"],
      ["Wall Clock", 699, 3999, "a silent sweep movement and a minimalist dial"],
      ["Table Lamp", 1299, 6999, "a warm fabric shade on a sculpted ceramic base"],
      ["Dinner Set", 1999, 8999, "chip-resistant stoneware plates and bowls for six"],
    ],
  },
  Books: {
    titles: [
      ["The Art of Clean Code", "a modern guide to writing readable, maintainable software"],
      ["Foundations of Databases", "a clear, example-driven introduction to SQL and query optimisation"],
      ["Atlas of the Cosmos", "a stunning hardcover journey through galaxies and nebulae"],
      ["The Midnight Library", "a moving novel about the infinite lives we could have lived"],
      ["Mindful Mornings Journal", "a guided 90-day journal for gratitude and intentional living"],
      ["Deep Work", "rules for focused success in a distracted world"],
      ["Sapiens: A Brief History", "a sweeping account of how humankind came to rule the planet"],
      ["The Pragmatic Programmer", "timeless lessons for building better software and careers"],
      ["Project Hail Mary", "a lone astronaut, an impossible mission, and a surprising friend"],
      ["Thinking, Fast and Slow", "the two systems that drive the way we think and decide"],
      ["Clean Architecture", "a craftsman's guide to software structure and design"],
      ["The Silent Patient", "a shocking psychological thriller of a woman's act of violence"],
      ["Educated: A Memoir", "a young woman's quest for knowledge against all odds"],
      ["Designing Data-Intensive Apps", "the big ideas behind reliable, scalable systems"],
      ["The Alchemist", "a magical fable about following your dream"],
      ["Ikigai", "the Japanese secret to a long and happy life"],
      ["A Brief History of Time", "the universe, black holes and the nature of reality"],
      ["The Psychology of Money", "timeless lessons on wealth, greed and happiness"],
      ["Dune", "a desert planet, a noble family and a galaxy-spanning epic"],
      ["Atomic Habits", "tiny changes that deliver remarkable results"],
    ],
    brands: ["Paperhaus", "Inkwell", "Monsoon Press", "Keystone"],
    priceRange: [199, 1999],
  },
  Beauty: {
    brands: ["Lumière", "Dewy", "Velvet", "Pure", "Bloom", "Aura", "Silk", "Glow"],
    types: [
      ["Vitamin C Face Serum", 499, 3999, "a brightening serum that evens tone and boosts radiance"],
      ["Hydrating Moisturiser", 399, 2999, "a lightweight gel-cream for all-day hydration"],
      ["Matte Lipstick", 299, 1999, "a creamy, long-wear colour with a velvety matte finish"],
      ["Repair Shampoo", 299, 1999, "a sulphate-free formula that strengthens and smooths"],
      ["Eau de Parfum", 999, 6999, "a long-lasting fragrance with notes of citrus and musk"],
      ["Mineral Sunscreen SPF50", 399, 2499, "broad-spectrum, non-greasy protection for daily wear"],
      ["Gentle Face Wash", 249, 1499, "a pH-balanced cleanser that removes impurities without stripping"],
      ["Argan Hair Oil", 349, 2499, "a nourishing oil that tames frizz and adds shine"],
      ["Beard Grooming Kit", 599, 3499, "oil, balm and a comb for a soft, well-kept beard"],
      ["Clay Face Mask", 399, 2299, "a purifying mask that draws out impurities and refines pores"],
    ],
  },
  Sports: {
    brands: ["Apex", "Stride", "Vanguard", "Titan", "Rally", "Summit", "Kinetic"],
    types: [
      ["Yoga Mat", 599, 3999, "a non-slip, cushioned mat with alignment guides"],
      ["Adjustable Dumbbell Set", 2999, 19999, "space-saving dumbbells that adjust from light to heavy"],
      ["Cricket Bat", 1499, 12999, "a grade-A English willow bat with a powerful sweet spot"],
      ["Football", 499, 3999, "a match-grade ball with a durable, true-flight panel design"],
      ["Badminton Racket", 699, 6999, "a lightweight graphite frame for fast, controlled swings"],
      ["Cycling Helmet", 1299, 7999, "an aerodynamic, well-ventilated helmet with MIPS protection"],
      ["Resistance Bands Set", 499, 2999, "five progressive bands for strength and mobility training"],
      ["Insulated Sports Bottle", 399, 1999, "a leak-proof bottle that keeps water cold through any workout"],
      ["Running Belt", 399, 1999, "a bounce-free belt that holds your phone, keys and cards"],
      ["Tennis Racket", 1999, 13999, "a balanced frame offering power and spin for every rally"],
    ],
  },
  Toys: {
    brands: ["Jumbo", "Spark", "Wonder", "Tinker", "Clever", "Playful"],
    types: [
      ["Building Blocks Set", 699, 6999, "hundreds of colourful bricks for endless creative builds"],
      ["Remote Control Car", 999, 7999, "a fast 2.4GHz RC car with grippy tyres and a rechargeable pack"],
      ["1000-Piece Puzzle", 399, 1999, "a beautifully illustrated jigsaw for relaxing afternoons"],
      ["Family Board Game", 599, 3499, "a fast, funny game that plays in 30 minutes"],
      ["Plush Soft Toy", 299, 2499, "an irresistibly huggable, super-soft companion"],
      ["STEM Science Kit", 899, 4999, "dozens of safe, hands-on experiments for curious minds"],
      ["Wooden Train Set", 1299, 6999, "a classic wooden track with magnetic carriages"],
      ["Art & Craft Set", 499, 2999, "a complete kit of paints, crayons and paper to spark creativity"],
      ["Drone for Kids", 1499, 6999, "an easy-to-fly mini drone with auto-hover and flips"],
      ["Doll House", 1999, 9999, "a charming multi-room house with furniture and figures"],
    ],
  },
  Grocery: {
    brands: ["Harvest", "Daily", "Pure", "Golden", "Roast", "Orchard"],
    types: [
      ["Arabica Coffee Beans", 349, 1999, "single-origin beans, medium-roasted for a smooth, rich cup"],
      ["Green Tea", 199, 1299, "whole-leaf green tea with a fresh, delicate aroma"],
      ["Extra-Virgin Olive Oil", 399, 2499, "cold-pressed oil with a fruity, peppery finish"],
      ["Raw Forest Honey", 299, 1799, "unprocessed, single-source honey straight from the hive"],
      ["Dark Chocolate Bar", 149, 999, "70% cocoa with a deep, smooth and slightly bitter taste"],
      ["Premium Almonds", 399, 2499, "crunchy, hand-picked whole almonds rich in nutrients"],
      ["Protein Bars (Box)", 499, 2499, "high-protein, low-sugar bars for a wholesome snack"],
      ["Durum Wheat Pasta", 149, 899, "bronze-cut pasta that holds sauce beautifully"],
      ["Masala Spice Box", 499, 2999, "a curated set of freshly ground everyday spices"],
      ["Granola Clusters", 299, 1499, "baked oat clusters with nuts, seeds and a hint of honey"],
    ],
  },
};

function buildCatalog() {
  const products = [];
  const seenNames = new Set();

  // Books: use real-ish titles.
  for (const [title, desc] of SPECS.Books.titles) {
    products.push({
      name: title,
      price: price(...SPECS.Books.priceRange),
      category: "Books",
      stock: stock(),
      rating: rating(),
      description: `${desc}. Published by ${pick(SPECS.Books.brands)}.`,
    });
    seenNames.add(title);
  }

  // Everything else: Brand + Type, generated with variety.
  const COLOURS = ["Midnight", "Graphite", "Ivory", "Sand", "Forest", "Crimson", "Slate", "Rose Gold", "Ocean", "Pearl"];
  for (const [category, spec] of Object.entries(SPECS)) {
    if (category === "Books") continue;
    // Aim for ~18 products per category.
    let made = 0;
    let guard = 0;
    while (made < PER_CAT && guard < 8000) {
      guard++;
      const [type, min, max, desc] = pick(spec.types);
      const brand = pick(spec.brands);
      const colour = pick(COLOURS);
      // Vary the name so brand+type combos stay unique.
      const name =
        Math.random() < 0.5
          ? `${brand} ${type}`
          : `${brand} ${colour} ${type}`;
      if (seenNames.has(name)) continue;
      seenNames.add(name);
      products.push({
        name,
        price: price(min, max),
        category,
        stock: stock(),
        rating: rating(),
        description: `The ${name} — ${desc}.`,
      });
      made++;
    }
  }
  return products;
}

async function main() {
  const catalog = buildCatalog();
  console.log(`Generated ${catalog.length} products across 8 categories.`);

  console.log("Clearing existing products…");
  await pool.query("DELETE FROM products");

  console.log("Inserting new catalog…");
  // Batched multi-row insert.
  const values = [];
  const rows = [];
  catalog.forEach((p, i) => {
    const b = i * 7;
    rows.push(`($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5},$${b + 6},$${b + 7})`);
    values.push(makeId("p"), p.name, p.price, p.category, p.stock, p.rating, p.description);
  });
  await pool.query(
    `INSERT INTO products (id, name, price, category, stock, rating, description) VALUES ${rows.join(",")}`,
    values
  );

  const { rows: countRows } = await pool.query("SELECT COUNT(*)::int n FROM products");
  console.log(`Done. Products in catalog: ${countRows[0].n}`);
  await pool.end();
}

main().catch((err) => {
  console.error("Seed failed:", err.message);
  process.exit(1);
});
