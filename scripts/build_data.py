#!/usr/bin/env python3
"""Snapshot TheCocktailDB (free public API, https://www.thecocktaildb.com/api.php)
into js/cocktails.js, adding derived flavor tags and an estimated strength per drink.

    python3 scripts/build_data.py            # build from data/raw/cocktaildb.json (fetches it if missing)
    python3 scripts/build_data.py --refresh  # re-download the raw snapshot first
"""
import json
import re
import string
import sys
import time
import urllib.request
from collections import Counter
from fractions import Fraction
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw" / "cocktaildb.json"
OUT = ROOT / "js" / "cocktails.js"
API = "https://www.thecocktaildb.com/api/json/v1/1/search.php?f={}"

# Raw ingredient name -> what someone would say they have at home. First match wins.
FAMILIES = [
    (r"malibu|coconut rum", "coconut rum"),
    (r"\brum\b|bacardi", "rum"),
    (r"sloe gin", "sloe gin"),
    (r"\bgin\b", "gin"),
    (r"vodka|absolut", "vodka"),
    (r"mezcal", "mezcal"),
    (r"tequila", "tequila"),
    (r"southern comfort", "southern comfort"),
    (r"whisk|bourbon|scotch|\brye\b|jack daniels|jim beam|wild turkey|crown royal|johnnie walker|yukon jack", "whiskey"),
    (r"^(brandy|cognac|applejack|apple brandy|pisco)$", "brandy"),
    (r"blue curacao", "blue curacao"),
    (r"triple sec|cointreau|grand marnier|curacao", "triple sec"),
    (r"kahlua|tia maria|coffee liqueur|coffee brandy", "coffee liqueur"),
    (r"baileys|irish cream", "irish cream"),
    (r"j[äa]germeister", "jägermeister"),
    (r"sambuca|ouzo|pernod|ricard|anis", "anise liqueur"),
    (r"champagne|prosecco", "sparkling wine"),
    (r"sweet vermouth|rosso vermouth|^vermouth$", "sweet vermouth"),
    (r"ginger beer", "ginger beer"),
    (r"ginger ale", "ginger ale"),
    (r"root beer|sarsaparilla", "root beer"),
    (r"beer|lager|corona|guinness", "beer"),
    (r"soda water|club soda|carbonated water", "soda water"),
    (r"coca-cola|pepsi|dr\. pepper|^cola$", "cola"),
    (r"7-up|sprite|lemon-lime|fresca|mountain dew|surge", "lemon-lime soda"),
    (r"angostura|^bitters$", "bitters"),
    (r"lime juice|^lime$|lime peel", "lime"),
    (r"lemon juice|^lemon$|lemon peel", "lemon"),
    (r"orange juice|^orange$|orange peel|orange spiral|blood orange", "orange"),
    (r"^pineapple( juice)?$", "pineapple"),
    (r"^(grapefruit|cranberry|apple|passion fruit|pomegranate|grape|cherry|apricot) (juice|nectar)$", r"\1"),
    (r"heavy cream|light cream|whipping cream|half-and-half|^cream$", "cream"),
    (r"^mint$", "mint"),
    (r"sugar syrup", "simple syrup"),
    (r"^egg( white| yolk)?$", "egg"),
    (r"yoghurt", "yogurt"),
    (r"strawberries", "strawberry"),
    (r"blackberries", "blackberry"),
    (r"cherries|maraschino cherry", "cherry"),
    (r"^figs$", "fig"),
    (r"^(coffee|espresso)$", "coffee"),
    (r"^(tea|iced tea)$", "tea"),
    (r"chocolate syrup|hot chocolate|^chocolate$|cocoa powder", "chocolate"),
    (r"vanilla ice-cream", "vanilla ice cream"),
    (r"elderflower|st\. germain", "elderflower"),
    (r"sour mix|sweet and sour", "sour mix"),
    (r"^(powdered|demerara|brown) sugar$", "sugar"),
    (r"black pepper", "pepper"),
]

# Never counted as "missing" — nearly everyone has these.
PANTRY = {"ice", "water", "sugar", "salt", "pepper", "simple syrup"}

# Extra things people type that never appear verbatim in the dataset.
EXTRA_ALIASES = {
    "bourbon": "whiskey", "scotch": "whiskey", "rye": "whiskey", "whisky": "whiskey",
    "cognac": "brandy", "white rum": "rum", "dark rum": "rum", "silver tequila": "tequila",
    "cointreau": "triple sec", "orange liqueur": "triple sec", "kahlua": "coffee liqueur",
    "baileys": "irish cream", "soda": "soda water", "club soda": "soda water", "seltzer": "soda water",
    "sparkling water": "soda water", "coke": "cola", "sprite": "lemon-lime soda", "7up": "lemon-lime soda",
    "tonic": "tonic water", "prosecco": "sparkling wine", "champagne": "sparkling wine", "cava": "sparkling wine",
    "bubbly": "sparkling wine", "mint leaves": "mint", "half and half": "cream", "espresso": "coffee",
    "simple syrup": "simple syrup", "honey syrup": "honey", "agave": "agave syrup", "lemons": "lemon",
    "limes": "lime", "oranges": "orange", "eggs": "egg", "egg white": "egg", "ice cream": "vanilla ice cream",
    "aperitivo": "aperol", "vermouth": "sweet vermouth",
}

FLAVORS = {
    "citrus": r"lemon|lime|grapefruit|orange juice|^orange$|sour mix|sweet and sour|triple sec|cointreau|grand marnier|curacao",
    "tropical": r"pineapple|coconut|malibu|mango|passion|papaya|banana|banane|orgeat|falernum|pisang|passoa|pina colada",
    "fruity": r"cranberr|strawberr|raspberr|chambord|blackberr|blueberr|cassis|blackcurrant|creme de mure|pomegranate|grenadine|cherr|kiwi|kool-aid|fruit|apple|pear|peach|apricot|cider|fig|grape|melon|midori",
    "creamy": r"cream|milk|baileys|yoghurt|yogurt|half-and-half|advocaat|\begg\b|condensed|butter|sherbet",
    "coffee": r"coffee|espresso|kahlua|tia maria",
    "chocolate": r"cacao|chocolate|cocoa|godiva|oreo|marshmallow",
    "spiced": r"cinnamon|clove|nutmeg|allspice|cardamom|ginger|goldschlager|hot damn|spiced rum|maple|honey|vanilla|butterscotch|demerara|brown sugar",
    "herbal": r"\bmint\b|menthe|chartreuse|benedictine|absinthe|basil|rosemary|thyme|galliano|j[äa]germeister|sambuca|ouzo|pernod|ricard|anis|cucumber|drambuie|wormwood|coriander|\btea\b",
    "floral": r"elderflower|st\. germain|lavender|\brose\b|sirup of roses|violet|lillet",
    "bitter": r"campari|aperol|bitters|amaro|tonic|bitter lemon|dubonnet|vermouth|grapefruit",
    "fizzy": r"soda|tonic|ginger ale|ginger beer|champagne|prosecco|\bcola\b|7-up|sprite|beer|lager|corona|guinness|carbonated|cider|fresca|mountain dew|surge|zima|schweppes|bitter lemon|lemonade|dr\. pepper",
    "bubbly": r"champagne|prosecco",
    "savory": r"tabasco|hot sauce|worcestershire|pepper|celery|tomato|chili|cayenne|olive|soy sauce|cumin|asafoetida",
    "smoky": r"mezcal|islay|scotch",
    "sweet": r"sugar|syrup|grenadine|amaretto|schnapps|frangelico|liqueur|kahlua|baileys|\bcola\b|7-up|sprite|kool-aid|condensed|honey|chocolate|sherbet|ice-cream|creme de|midori|southern comfort|galliano|malibu|lemonade|jello|marshmallow|oreo|maple",
}

# Rough ABV by ingredient, checked in order so liqueurs win over the spirit in their name ("apricot brandy").
ABV = [
    (r"ginger beer|root beer|non.?alcoholic", 0),
    (r"151|everclear|grain alcohol|firewater|absinthe|wormwood", 0.6),
    (r"chartreuse|ricard|pernod|ouzo|rumple minze", 0.45),
    (r"liqueur|schnapps|triple sec|cointreau|grand marnier|curacao|amaretto|kahlua|tia maria|baileys|irish cream|frangelico"
     r"|chambord|midori|galliano|sambuca|anisette|creme de|benedictine|drambuie|southern comfort|campari|aperol"
     r"|j[äa]germeister|goldschlager|hot damn|passoa|pisang|advocaat|godiva|apfelkorn|malibu|heering|sloe gin|amaro"
     r"|(apricot|cherry|blackberry|peach|coffee) brandy|st\. germain|yukon jack|falernum|anis|butterscotch", 0.25),
    (r"rum|vodka|\bgin\b|tequila|mezcal|whisk|bourbon|scotch|\brye\b|brandy|cognac|applejack|pisco|cachaca"
     r"|jack daniels|jim beam|wild turkey|crown royal|johnnie walker|absolut|bacardi", 0.4),
    (r"vermouth|port|sherry|lillet|dubonnet", 0.17),
    (r"wine|champagne|prosecco", 0.12),
    (r"beer|lager|corona|guinness|cider|zima", 0.05),
]

UNIT_ML = [
    (r"\boz\b", 30), (r"\bcl\b", 10), (r"\bml\b", 1), (r"\bl\b", 1000), (r"shots?|jiggers?|measures?", 45),
    (r"parts?", 30), (r"cups?", 240), (r"\btsp\b", 5), (r"tblsp|tbsp", 15), (r"dash(es)?", 1), (r"drops?", 0.05),
    (r"splash", 8), (r"pint", 470), (r"\bqt\b", 950), (r"\bgal\b", 3785), (r"fifth", 750), (r"bottle", 700),
    (r"juice of", 30), (r"glass", 200),
]
SOLID_UNITS = r"slice|wedge|whole|twist|cube|sprig|pinch|garnish|chunk|pod|inch|chopped|ground|to taste"
LIQUID = r"juice|soda|water|cola|ale|beer|tonic|milk|cream|syrup|wine|tea|coffee|espresso|lemonade|sprite|7-up|cider|nectar|mix|punch|vermouth|liqueur|schnapps"


def fetch_raw():
    drinks = {}
    for c in string.ascii_lowercase + string.digits:
        req = urllib.request.Request(API.format(c), headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=30) as r:
            for d in json.load(r)["drinks"] or []:
                drinks[d["idDrink"]] = {k: v for k, v in d.items() if not re.match(r"strInstructions[A-Z]", k)}
        time.sleep(0.3)
    RAW.parent.mkdir(parents=True, exist_ok=True)
    RAW.write_text(json.dumps(sorted(drinks.values(), key=lambda d: d["strDrink"].lower()), indent=1))


def first_match(table, name, default=None):
    for pattern, value in table:
        if re.search(pattern, name):
            return value
    return default


def family(name):
    for pattern, key in FAMILIES:
        if re.search(pattern, name):
            return re.sub(pattern, key, name) if "\\1" in key else key
    return name


def parse_amount(measure):
    m = re.search(r"(\d+\s+\d+/\d+|\d+/\d+|\d*\.\d+|\d+)(?:\s*-\s*(\d+/\d+|\d*\.\d+|\d+))?", measure)
    if not m:
        return None
    to_num = lambda s: float(sum(Fraction(p) for p in s.split()))
    lo = to_num(m.group(1))
    return (lo + to_num(m.group(2))) / 2 if m.group(2) else lo


def volume_ml(name, measure, abv):
    measure = (measure or "").lower().strip()
    if re.search(r"fill|top|full glass", measure):
        return 120
    if re.search(SOLID_UNITS, measure):
        return 0
    unit = first_match(UNIT_ML, measure)
    amount = parse_amount(measure)
    if unit is not None:
        return unit * (amount if amount is not None else 1)
    if abv > 0:
        return 45 if abv >= 0.35 else 30
    return 90 if re.search(LIQUID, name) and not measure else 0


def build():
    raw = json.loads(RAW.read_text())
    usage = Counter()
    for d in raw:
        usage.update({family((d[f"strIngredient{i}"] or "").strip().lower()) for i in range(1, 16)} - {""})

    drinks, aliases, key_flavors = [], dict(EXTRA_ALIASES), {}
    for d in raw:
        alc = {"Alcoholic": "alcoholic", "Non alcoholic": "none"}.get(d["strAlcoholic"], "optional")
        ingredients, flavors = [], set()
        total_ml = alcohol_ml = 0.0
        for i in range(1, 16):
            name = (d[f"strIngredient{i}"] or "").strip()
            if not name:
                continue
            low = name.lower()
            measure = (d[f"strMeasure{i}"] or "").strip()
            key = family(low)
            aliases[low] = key
            abv = 0 if alc == "none" else first_match(ABV, low, 0)
            ml = volume_ml(low, measure, abv)
            total_ml += ml
            alcohol_ml += ml * abv
            own = {f for f, pattern in FLAVORS.items() if re.search(pattern, low)}
            flavors |= own
            key_flavors.setdefault(key, set()).update(own)
            optional = bool(re.search(r"garnish|twist|to taste", measure.lower()))
            entry = {"n": name, "m": measure, "k": key}
            if key in PANTRY or optional:
                entry["p"] = 1
            ingredients.append(entry)

        text = (d["strInstructions"] or "").strip()
        low_text = text.lower()
        glass = (d["strGlass"] or "").strip()
        tags = {t.strip().lower() for t in (d["strTags"] or "").split(",") if t.strip()}
        # Many chilled drinks heat a syrup during prep, so only trust heat verbs when nothing is chilled.
        names = " ".join(e["n"].lower() for e in ingredients) + " " + d["strDrink"].lower()
        served_hot = re.search(r"serve[sd]? (it )?(hot|warm)|while (still )?hot|piping|steaming|mulled|toddy", low_text + " " + names)
        heated = re.search(r"\b(hot|heat|heated|warm|warmed|boil|boiling|microwave|simmer)\b|coffee mug|irish coffee cup", low_text + " " + glass.lower())
        chilled = re.search(r"\bice\b|\biced\b|chill|cool|refrigerat|freez|frozen|\bcold\b|jello|bottle|store", low_text + " " + names)
        if "iced" not in d["strDrink"].lower() and (served_hot or (heated and not chilled and "fizzy" not in flavors)):
            flavors.add("hot")
        if re.search(r"\bblend(?!ed (scotch|whisk))", low_text) or "frozen" in tags:
            flavors.add("frozen")
        if re.search(r"\blayer|\bfloat", low_text):
            flavors.add("layered")
        if d["strCategory"] == "Punch / Party Drink":
            flavors.add("party")
        if d["strCategory"] == "Shot":
            flavors.add("shot")
        if d["strIBA"] or tags & {"iba", "classic", "contemporaryclassic"}:
            flavors.add("classic")
        if any(usage[e["k"]] <= 2 and not e.get("p") for e in ingredients):
            flavors.add("unusual")

        abv = alcohol_ml / total_ml if total_ml else 0
        if alc == "none":
            abv = 0
        strength = 0 if abv == 0 else 1 if abv < 0.12 else 2 if abv < 0.24 else 3
        if strength == 3:
            flavors.add("boozy")
        elif strength <= 1:
            flavors.add("light")

        steps = [s.strip() for s in re.split(r"(?<=[.!?])\s+(?=[A-Z])", text) if s.strip()]
        drinks.append({
            "id": d["idDrink"], "name": d["strDrink"].strip(), "img": d["strDrinkThumb"],
            "category": d["strCategory"], "alc": alc, "glass": glass, "iba": d["strIBA"],
            "abv": round(abv * 100), "strength": strength, "flavors": sorted(flavors),
            "ingredients": ingredients, "steps": steps,
        })

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(
        "// Generated by scripts/build_data.py from TheCocktailDB (https://www.thecocktaildb.com). Do not edit by hand.\n"
        f"window.COCKTAILS = {json.dumps(drinks, ensure_ascii=False, separators=(',', ':'))};\n"
        f"window.INGREDIENT_ALIASES = {json.dumps(dict(sorted(aliases.items())), ensure_ascii=False, separators=(',', ':'))};\n"
        f"window.INGREDIENT_FLAVORS = {json.dumps({k: sorted(v) for k, v in sorted(key_flavors.items()) if v}, ensure_ascii=False, separators=(',', ':'))};\n"
    )
    print(f"Wrote {len(drinks)} drinks to {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    if "--refresh" in sys.argv or not RAW.exists():
        fetch_raw()
    build()
