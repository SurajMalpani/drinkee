# Drinkee: What Should I Drink?

Static cocktail recommender. Add an ingredient or two and hit **Surprise me** for five drinks that use them. Or set weather, mood and strength and hit **Mix me something** for a ranked list.

## Run

Open `index.html` in a browser. No server or install needed.

## Files

- `index.html`, `styles.css`: the page.
- `logo.jpg`, `favicon.png`: header logo and tab icon, cropped from `drinkee_logo.jpg` (the original).
- `js/app.js`: scoring, surprise picks, the weather lookup and the UI.
- `js/cocktails.js`: generated data. Don't edit it by hand.
- `scripts/build_data.py`: builds `js/cocktails.js` from `data/raw/cocktaildb.json`.

## Rebuilding the data

```sh
python3 scripts/build_data.py            # rebuild from the cached snapshot
python3 scripts/build_data.py --refresh  # re-download from TheCocktailDB first
```

If the download hits SSL errors behind a corporate proxy, prefix the command with `SSL_CERT_FILE=/etc/ssl/cert.pem`.

## How it works

- The build script maps ingredients to plain names (bourbon becomes "whiskey"), tags flavors (citrus, creamy, hot, frozen and so on) and estimates ABV from the measures.
- Ranking: drinks using the most of your ingredients come first. Among drinks that use the same number, spirits win, then the closest vibe match. Non-spirit ingredients also boost drinks with a similar flavor, so orange boosts citrusy drinks.
- Surprise me follows the same order. Drinks that use all your ingredients always show. Leftover slots (up to 5) are drawn at random from the next-best group, nudged toward your weather, flavor, mood and strength picks.
- Fine-tune runs top-down: season, then weather, flavors, mood and strength. Changing one resets the defaults below it. For example, summer picks sunny, tropical and citrus, then chill; winter picks cold, warm and spiced, then cozy.
- With strength on "Any", zero-proof drinks are ranked lower.
- An "About me" card follows the drinks: the no-app, no-sign-up, no-ads promise and donation links. Before publishing, replace the placeholders in `#about-template` in `index.html`: `YOUR_HANDLE` in the PayPal and Venmo links, and `YOUR_UPI_ID`, `YOUR_NAME` and `yourname@bank` for UPI. [Munchee](../munchee/) has the same card.

## Notes

- Flavor tags and ABV are rough keyword-based guesses.
- Photos come from TheCocktailDB.
- "Use my weather" needs location permission and uses Open-Meteo (free, no key).
- Data: [TheCocktailDB](https://www.thecocktaildb.com) free API, 441 drinks.
