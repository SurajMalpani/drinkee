(() => {
  const QUICK_ADD = ["vodka", "gin", "rum", "tequila", "whiskey", "triple sec", "lime", "lemon", "orange", "mint", "soda water", "sparkling wine", "coffee", "cream"];
  const SPIRITS = ["vodka", "gin", "rum", "coconut rum", "tequila", "mezcal", "whiskey", "brandy", "cachaca", "sloe gin", "southern comfort"];
  const MAX_RESULTS = 12;
  const SURPRISE_COUNT = 5;

  const FEATURES = {
    citrus: "🍋 Citrusy", tropical: "🍍 Tropical", fruity: "🍓 Fruity", creamy: "🥛 Creamy", coffee: "☕ Coffee kick",
    chocolate: "🍫 Chocolatey", spiced: "🌰 Warm spice", herbal: "🌿 Herbal", floral: "🌸 Floral", bitter: "🍊 Bittersweet",
    fizzy: "🫧 Fizzy", bubbly: "🥂 Bubbly", savory: "🧂 Savory", smoky: "💨 Smoky", sweet: "🍬 Sweet", hot: "♨️ Served hot",
    frozen: "🧊 Frozen", layered: "🌈 Layered", party: "🎉 Party batch", shot: "🥃 Shot", classic: "🏛️ Classic",
    unusual: "🧪 Unusual", boozy: "💪 Spirit-forward", light: "🪶 Easy-drinking",
  };

  // Each choice nudges flavor features up or down; a drink's vibe score is the sum over its features.
  const SEASONS = {
    spring: { floral: 2, herbal: 1.5, fruity: 1, fizzy: 1, citrus: 1, hot: -1.5, creamy: -0.5 },
    summer: { citrus: 2, tropical: 2, frozen: 2, fizzy: 1.5, fruity: 1, light: 1, hot: -3, creamy: -1, coffee: -1, spiced: -1 },
    autumn: { spiced: 2, smoky: 1, bitter: 1, boozy: 1, coffee: 0.5, fruity: 0.5, frozen: -1.5, tropical: -1 },
    winter: { hot: 3, spiced: 2, creamy: 1.5, coffee: 1.5, chocolate: 1.5, boozy: 1, frozen: -3, tropical: -1.5, fizzy: -0.5 },
  };
  const WEATHER = {
    scorching: { frozen: 2.5, fizzy: 2, citrus: 1.5, light: 1.5, tropical: 1, hot: -4, creamy: -1.5, boozy: -1 },
    sunny: { fizzy: 1.5, citrus: 1.5, fruity: 1, tropical: 1, hot: -2 },
    mild: {},
    cool: { spiced: 1, boozy: 0.5, bitter: 0.5, frozen: -1 },
    rainy: { coffee: 2, spiced: 1.5, hot: 1.5, creamy: 1, smoky: 1, boozy: 1, frozen: -2 },
    cold: { hot: 3.5, creamy: 2, chocolate: 2, spiced: 2, coffee: 1.5, frozen: -4, fizzy: -1 },
  };
  const MOODS = {
    any: { label: "🤷 Whatever", w: {}, strength: "any" },
    celebrating: { label: "🎉 Celebrating", w: { bubbly: 4, fizzy: 1.5, fruity: 1, party: 1 }, strength: "easy" },
    chill: { label: "😌 Chill", w: { light: 1.5, fizzy: 1.5, citrus: 1, tropical: 1, boozy: -1 }, strength: "easy" },
    cozy: { label: "🧣 Cozy", w: { hot: 2.5, creamy: 2, spiced: 2, chocolate: 1.5, coffee: 1 }, strength: "any" },
    adventurous: { label: "🧭 Adventurous", w: { unusual: 2.5, herbal: 2, bitter: 1.5, smoky: 2, savory: 2, layered: 1 }, strength: "any" },
    classy: { label: "🎩 Classy", w: { classic: 3, boozy: 1.5, bitter: 1, sweet: -1.5, party: -1, shot: -2 }, strength: "strong" },
    tired: { label: "😴 Pick-me-up", w: { coffee: 4, citrus: 1, fizzy: 0.5 }, strength: "any" },
  };
  // Flavor chip -> drink feature it boosts.
  const FLAVOR_CHOICES = {
    citrus: "citrus", tropical: "tropical", fruity: "fruity", fizzy: "fizzy", frozen: "frozen", warm: "hot",
    creamy: "creamy", coffee: "coffee", spiced: "spiced", herbal: "herbal", bitter: "bitter", smoky: "smoky",
  };
  const FLAVOR_LABELS = { ...FEATURES, warm: "♨️ Warm" };
  const STRENGTHS = {
    any: () => true,
    zero: (d) => d.strength === 0 || d.alc === "optional",
    easy: (d) => d.strength === 1 || d.strength === 2,
    strong: (d) => d.strength === 3,
  };

  // Top-down defaults: each field's choice decides the starting value of the fields below it.
  const SEASON_WEATHER = { spring: "mild", summer: "sunny", autumn: "cool", winter: "cold" };
  const WEATHER_FLAVORS = {
    scorching: ["frozen", "tropical"], sunny: ["tropical", "citrus"], mild: ["citrus", "fruity"],
    cool: ["spiced"], rainy: ["warm", "coffee"], cold: ["warm", "spiced"],
  };
  // First checked flavor in this order picks the mood; otherwise the weather does.
  const FLAVOR_MOOD = [
    ["warm", "cozy"], ["coffee", "tired"], ["creamy", "cozy"], ["smoky", "adventurous"], ["herbal", "adventurous"],
    ["bitter", "classy"], ["fizzy", "celebrating"], ["tropical", "chill"], ["frozen", "chill"], ["citrus", "chill"],
    ["fruity", "chill"], ["spiced", "cozy"],
  ];
  const WEATHER_MOOD = { scorching: "chill", sunny: "chill", mild: "any", cool: "any", rainy: "cozy", cold: "cozy" };

  const FLAVOR_WEIGHT = 2.5;
  const AFFINITY_WEIGHT = 3;
  const ZERO_PROOF_PENALTY = 6;
  const STRENGTH_MISMATCH_PENALTY = 3;
  // Higher = Surprise me follows your weather/flavor/mood picks less strictly.
  const SURPRISE_TEMPERATURE = 5;
  const STRENGTH_LABELS = ["Zero-proof", "Light", "Medium", "Strong"];

  const form = document.getElementById("prefs");
  const input = document.getElementById("ingredient-input");
  const chipsEl = document.getElementById("chips");
  const quickAddEl = document.getElementById("quick-add");
  const seasonEl = document.getElementById("season");
  const weatherEl = document.getElementById("weather");
  const moodsEl = document.getElementById("moods");
  const flavorsEl = document.getElementById("flavors");
  const locateBtn = document.getElementById("locate");
  const locateStatus = document.getElementById("locate-status");
  const summaryEl = document.getElementById("summary");
  const resultsEl = document.getElementById("results");
  const template = document.getElementById("card-template");
  const aboutCard = document.getElementById("about-template").content.firstElementChild.cloneNode(true);

  const have = new Set();
  let lastSurprise = new Set();

  // Maps whatever the user typed onto the canonical keys used in the data ("limes" -> "lime", "bourbon" -> "whiskey").
  function normalize(text) {
    const t = text.toLowerCase().trim().replace(/\s+/g, " ");
    if (!t) return "";
    const candidates = [
      t,
      t.replace(/^fresh /, ""),
      t.replace(/ juice$/, ""),
      t.replace(/ies$/, "y"),
      t.replace(/(?<!s)s$/, ""),
      `${t} juice`,
    ];
    for (const c of candidates) if (INGREDIENT_ALIASES[c]) return INGREDIENT_ALIASES[c];
    return candidates[4];
  }

  // The user's item is the drink's key, or a more specific version of it ("dark rum" covers "rum").
  const covers = (mine, key) => ` ${mine} `.includes(` ${key} `);
  const owns = (key) => [...have].some((h) => covers(h, key));
  const isSpirit = (item) => SPIRITS.some((s) => covers(item, s));
  const mySpirits = () => [...have].filter(isSpirit);
  const myOthers = () => [...have].filter((h) => !isSpirit(h));

  function addIngredient(raw) {
    raw.split(",").map(normalize).filter(Boolean).forEach((i) => have.add(i));
    renderChips();
  }

  function flushInput() {
    if (input.value.trim()) { addIngredient(input.value); input.value = ""; }
  }

  function renderChips() {
    chipsEl.innerHTML = "";
    have.forEach((item) => {
      const li = document.createElement("li");
      li.textContent = item;
      const x = document.createElement("button");
      x.type = "button";
      x.ariaLabel = `Remove ${item}`;
      x.textContent = "×";
      x.onclick = () => { have.delete(item); renderChips(); };
      li.appendChild(x);
      chipsEl.appendChild(li);
    });
    quickAddEl.querySelectorAll("button").forEach((b) => (b.disabled = have.has(b.dataset.item)));
  }

  // Non-spirit ingredients pull in drinks with the same character ("orange" -> citrusy), even if they don't use it.
  function affinityWeights() {
    const w = {};
    myOthers().forEach((h) => (INGREDIENT_FLAVORS[h] || []).forEach((f) => (w[f] = (w[f] || 0) + AFFINITY_WEIGHT)));
    return w;
  }

  function weightsFor(prefs) {
    const w = affinityWeights();
    const add = (src) => Object.entries(src).forEach(([f, v]) => (w[f] = (w[f] || 0) + v));
    add(SEASONS[prefs.season]);
    add(WEATHER[prefs.weather]);
    add(MOODS[prefs.mood].w);
    prefs.flavors.forEach((f) => add({ [FLAVOR_CHOICES[f]]: FLAVOR_WEIGHT }));
    return w;
  }

  function score(drink, weights, strength) {
    const needed = [...new Set(drink.ingredients.filter((i) => !i.p).map((i) => i.k))];
    const owned = needed.filter(owns);
    const missing = needed.filter((k) => !owned.includes(k));
    const uses = [...have].filter((h) => needed.some((k) => covers(h, k)));
    const spiritHits = uses.filter(isSpirit).length;
    // With strength on "Any", lean toward actual cocktails; zero-proof drinks still win when they fit much better.
    const mocktailPenalty = strength === "any" && drink.strength === 0 ? ZERO_PROOF_PENALTY : 0;
    const vibe = drink.flavors.reduce((sum, f) => sum + (weights[f] || 0), 0) - mocktailPenalty;
    const reasons = drink.flavors.filter((f) => (weights[f] || 0) > 0).sort((a, b) => weights[b] - weights[a]);
    // How many of your ingredients it uses sets the tier, your spirits break ties, then the vibe decides.
    const value = uses.length * 1000 + spiritHits * 300 + vibe * 8 - missing.length * 8;
    return { drink, needed, owned, missing, uses, spiritHits, reasons, vibe, value };
  }

  function suggest(prefs) {
    const weights = weightsFor(prefs);
    return COCKTAILS
      .filter(STRENGTHS[prefs.strength])
      .map((d) => score(d, weights, prefs.strength))
      .filter((s) => have.size === 0 || s.uses.length > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, MAX_RESULTS);
  }

  // Weighted draw without replacement: a better vibe and fewer missing ingredients raise the odds.
  function draw(group, count) {
    const bag = group.map((s) => ({ s, odds: Math.exp(Math.max(-10, Math.min(15, s.vibe)) / SURPRISE_TEMPERATURE) / (1 + s.missing.length * 0.5) }));
    const out = [];
    while (out.length < count && bag.length) {
      let r = Math.random() * bag.reduce((sum, b) => sum + b.odds, 0);
      const i = Math.max(0, bag.findIndex((b) => (r -= b.odds) < 0));
      out.push(bag.splice(i, 1)[0].s);
    }
    return out;
  }

  // Drinks using the most of your ingredients come first, spirits breaking ties. Leftover slots are drawn at random,
  // leaning toward the fine-tune picks (strength included, softly) and away from drinks shown last time.
  function surprise() {
    flushInput();
    const prefs = readPrefs();
    const weights = weightsFor(prefs);
    const scored = COCKTAILS
      .map((d) => score(d, weights, prefs.strength))
      .filter((s) => !have.size || s.uses.length)
      .map((s) => (STRENGTHS[prefs.strength](s.drink) ? s : { ...s, vibe: s.vibe - STRENGTH_MISMATCH_PENALTY }));
    resultsEl.innerHTML = "";
    if (!scored.length) {
      summaryEl.textContent = "No drink uses that. Try a different ingredient.";
      return;
    }
    const groups = new Map();
    scored.forEach((s) => {
      const key = s.uses.length * 100 + s.spiritHits;
      groups.set(key, [...(groups.get(key) || []), s]);
    });
    const picks = [];
    [...groups.keys()].sort((a, b) => b - a).forEach((key) => {
      const group = groups.get(key);
      const fresh = group.filter((s) => !lastSurprise.has(s.drink.id));
      const seen = group.filter((s) => lastSurprise.has(s.drink.id));
      picks.push(...draw(fresh, SURPRISE_COUNT - picks.length));
      picks.push(...draw(seen, SURPRISE_COUNT - picks.length));
    });
    lastSurprise = new Set(picks.map((s) => s.drink.id));

    const all = picks.filter((s) => s.uses.length === have.size).length;
    const using = have.size > 1
      ? all ? ` — ${all} use${all > 1 ? "" : "s"} all of your ${[...have].join(" & ")}` : ` — none use all of ${[...have].join(" & ")}, so here are the closest`
      : have.size ? ` with your ${[...have][0]}` : "";
    summaryEl.textContent = `🎲 ${picks.length} surprise pick${picks.length > 1 ? "s" : ""}${using}. Hit “Surprise me” again to reshuffle.`;
    picks.forEach((s, i) => resultsEl.appendChild(renderCard(s, i === 0)));
    resultsEl.appendChild(aboutCard);
  }

  function renderCard(s, featured) {
    const { drink } = s;
    const card = template.content.firstElementChild.cloneNode(true);
    if (featured) card.classList.add("featured");

    const real = card.querySelector("img.real");
    real.alt = drink.name;
    real.src = featured ? drink.img : `${drink.img}/medium`;
    real.onerror = () => (real.hidden = true);
    card.querySelector(".strength").textContent =
      drink.strength ? `${STRENGTH_LABELS[drink.strength]} · ~${drink.abv}% ABV` : drink.alc === "optional" ? "Alcohol optional" : "Zero-proof";

    card.querySelector(".title").textContent = drink.name;
    card.querySelector(".meta").textContent = [drink.category, drink.glass, drink.iba && `IBA ${drink.iba}`].filter(Boolean).join(" · ");
    card.querySelector(".match").textContent = s.uses.length ? `Uses your ${s.uses.join(", ")} · ${s.owned.length} of ${s.needed.length} ingredients on hand` : "";
    card.querySelector(".missing").textContent = have.size && s.missing.length ? `Need to grab: ${s.missing.join(", ")}` : "";

    const badges = card.querySelector(".badges");
    const shown = [...s.reasons, ...drink.flavors.filter((f) => !s.reasons.includes(f))].slice(0, featured ? 7 : 5);
    shown.forEach((f) => {
      const li = document.createElement("li");
      li.textContent = FEATURES[f] || f;
      if (s.reasons.includes(f)) li.classList.add("hit");
      badges.appendChild(li);
    });

    const ings = card.querySelector(".ings");
    drink.ingredients.forEach((i) => {
      const li = document.createElement("li");
      li.textContent = i.n;
      if (i.p) li.classList.add("pantry");
      else if (have.size && owns(i.k)) li.classList.add("have");
      if (i.m) {
        const qty = document.createElement("span");
        qty.className = "qty";
        qty.textContent = i.m;
        li.appendChild(qty);
      }
      ings.appendChild(li);
    });
    const steps = card.querySelector(".steps");
    drink.steps.forEach((t) => {
      const li = document.createElement("li");
      li.textContent = t;
      steps.appendChild(li);
    });
    if (featured) card.querySelector("details").open = true;

    return card;
  }

  function readPrefs() {
    return {
      season: seasonEl.value,
      weather: weatherEl.value,
      mood: form.querySelector('input[name="mood"]:checked').value,
      flavors: [...form.querySelectorAll('input[name="flavor"]:checked')].map((i) => i.value),
      strength: form.querySelector('input[name="strength"]:checked').value,
    };
  }

  // Re-derives every field below `level` (0 season, 1 weather, 2 flavors, 3 mood) from the ones above it.
  function cascade(level) {
    if (level < 1) weatherEl.value = SEASON_WEATHER[seasonEl.value];
    const weather = weatherEl.value;
    if (level < 2) {
      const picked = WEATHER_FLAVORS[weather];
      form.querySelectorAll('input[name="flavor"]').forEach((i) => (i.checked = picked.includes(i.value)));
    }
    if (level < 3) {
      const flavors = [...form.querySelectorAll('input[name="flavor"]:checked')].map((i) => i.value);
      const match = FLAVOR_MOOD.find(([f]) => flavors.includes(f));
      form.querySelector(`input[name="mood"][value="${match ? match[1] : WEATHER_MOOD[weather]}"]`).checked = true;
    }
    const mood = MOODS[form.querySelector('input[name="mood"]:checked').value];
    if (level < 4) {
      const strength = mood.strength !== "any" ? mood.strength : weather === "scorching" ? "easy" : "any";
      form.querySelector(`input[name="strength"][value="${strength}"]`).checked = true;
    }
  }

  function run() {
    flushInput();
    const prefs = readPrefs();
    const results = suggest(prefs);
    resultsEl.innerHTML = "";
    if (!results.length) {
      summaryEl.textContent = "Nothing fits. Try a different strength or ingredient.";
      return;
    }
    const mood = prefs.mood === "any" ? "" : ` for a ${MOODS[prefs.mood].label.replace(/^\S+\s/, "").toLowerCase()} mood`;
    const spirits = mySpirits();
    const first = spirits.length ? ` ${spirits.join(" & ")} drinks first.` : " Best match first.";
    summaryEl.textContent = `${results.length} pour${results.length > 1 ? "s" : ""}${mood} on a ${weatherEl.selectedOptions[0].text.replace(/^\S+\s/, "").toLowerCase()} ${prefs.season} day.${first}`;
    results.forEach((s, i) => resultsEl.appendChild(renderCard(s, i === 0)));
    resultsEl.appendChild(aboutCard);
  }

  function seasonFor(date, latitude = 1) {
    const order = ["winter", "winter", "spring", "spring", "spring", "summer", "summer", "summer", "autumn", "autumn", "autumn", "winter"];
    const month = latitude < 0 ? (date.getMonth() + 6) % 12 : date.getMonth();
    return order[month];
  }

  // WMO weather codes: https://open-meteo.com/en/docs
  function weatherFor(tempC, code) {
    if ([71, 73, 75, 77, 85, 86].includes(code)) return "cold";
    if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code >= 95) return "rainy";
    if (tempC >= 32) return "scorching";
    if (tempC >= 24) return "sunny";
    if (tempC >= 15) return "mild";
    if (tempC >= 6) return "cool";
    return "cold";
  }

  const WMO_TEXT = { 0: "clear", 1: "mostly clear", 2: "partly cloudy", 3: "overcast", 45: "foggy", 48: "foggy" };
  function describeCode(code) {
    if (WMO_TEXT[code]) return WMO_TEXT[code];
    if (code >= 51 && code <= 57) return "drizzle";
    if (code >= 61 && code <= 67) return "rain";
    if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "snow";
    if (code >= 80 && code <= 82) return "showers";
    return "thunderstorms";
  }

  function useMyWeather() {
    if (!navigator.geolocation) { locateStatus.textContent = "Location isn't available in this browser."; return; }
    locateBtn.disabled = true;
    locateStatus.textContent = "Checking the sky…";
    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
      try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${coords.latitude.toFixed(2)}&longitude=${coords.longitude.toFixed(2)}&current=temperature_2m,weather_code`;
        const { current } = await (await fetch(url)).json();
        const temp = Math.round(current.temperature_2m);
        seasonEl.value = seasonFor(new Date(), coords.latitude);
        weatherEl.value = weatherFor(temp, current.weather_code);
        cascade(1);
        locateStatus.textContent = `Right now: ${temp}°C and ${describeCode(current.weather_code)}.`;
        run();
      } catch {
        locateStatus.textContent = "Couldn't reach the weather service — pick it manually.";
      } finally {
        locateBtn.disabled = false;
      }
    }, () => {
      locateStatus.textContent = "Location permission denied — pick it manually.";
      locateBtn.disabled = false;
    }, { timeout: 10000, maximumAge: 30 * 60 * 1000 });
  }

  function toggle(name, value, label, type) {
    const l = document.createElement("label");
    l.innerHTML = `<input type="${type}" name="${name}" value="${value}" />`;
    l.append(label);
    return l;
  }

  Object.entries(MOODS).forEach(([key, m]) => moodsEl.appendChild(toggle("mood", key, m.label, "radio")));
  Object.keys(FLAVOR_CHOICES).forEach((f) => flavorsEl.appendChild(toggle("flavor", f, FLAVOR_LABELS[f], "checkbox")));

  const datalist = document.getElementById("ingredient-list");
  [...new Set(COCKTAILS.flatMap((d) => d.ingredients.filter((i) => !i.p).map((i) => i.k)))].sort().forEach((k) => {
    const o = document.createElement("option");
    o.value = k;
    datalist.appendChild(o);
  });

  seasonEl.value = seasonFor(new Date());
  cascade(0);

  input.addEventListener("keydown", (e) => {
    if ((e.key === "Enter" || e.key === ",") && input.value.trim()) {
      e.preventDefault();
      addIngredient(input.value);
      input.value = "";
    } else if (e.key === "Backspace" && !input.value && have.size) {
      have.delete([...have].pop());
      renderChips();
    }
  });
  input.addEventListener("change", () => {
    if (datalist.querySelector(`option[value="${CSS.escape(input.value)}"]`)) { addIngredient(input.value); input.value = ""; }
  });
  document.getElementById("chip-box").addEventListener("click", () => input.focus());
  document.getElementById("surprise").addEventListener("click", surprise);
  seasonEl.addEventListener("change", () => cascade(0));
  weatherEl.addEventListener("change", () => cascade(1));
  flavorsEl.addEventListener("change", () => cascade(2));
  moodsEl.addEventListener("change", () => cascade(3));
  locateBtn.addEventListener("click", useMyWeather);
  form.addEventListener("submit", (e) => { e.preventDefault(); run(); });

  QUICK_ADD.forEach((item) => {
    const b = document.createElement("button");
    b.type = "button";
    b.dataset.item = item;
    b.textContent = `+ ${item}`;
    b.onclick = () => addIngredient(item);
    quickAddEl.appendChild(b);
  });
})();
