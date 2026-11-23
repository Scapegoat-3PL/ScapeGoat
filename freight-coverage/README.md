# ScapeGoat — U.S. Freight & Logistics Coverage Map

A deployable, framework-free, typed TypeScript implementation of the four-level tactical freight coverage directory in `message (4).txt`, tailored to ScapeGoat's **existing static HTML / GitHub Pages architecture**. The source is tracked in `freight-coverage/` and the site build is published to `coverage/` through the scoped GitHub Actions workflow. GitHub Pages publication depends on the website deployment settings.

## What is delivered

- **66 crawlable static pages:** 1 national map, 5 regions, 15 corridors, 45 metropolitan hubs. Deep links work directly through static `index.html` pages; they do not depend on JavaScript execution for SEO title, description, H1, directory navigation or content discovery.
- **React-free interactive map:** real contiguous U.S. SVG state boundaries, five color-coded regions, glowing corridor supply lines, metro pins and smooth 560ms zoom-to-focus.
- **Bidirectional navigation:** selecting a map state, corridor or hub navigates; hovering/focusing a side-panel entry highlights the matching map element and vice versa.
- **Keyboard and mobile UX:** Escape/right-click zoom out, persistent breadcrumbs, 65/35 desktop and 45/55 mobile panel split, accessible labels/focus.
- **State/ZIP search:** states resolve locally; five-digit ZIP codes use Zippopotam.us at lookup time (requires network availability).
- **Southern California rule:** precisely three active hubs (Gardena, Commerce, Riverside) with user-specified coordinates, capabilities and artery labels. Other metro markers are expressly **market-directory placeholders**, not active warehouses.
- **Hub service rings:** 25-mile and 250-mile radial geodesic reference rings. These do **not** establish a guaranteed drayage tariff, coverage promise or 1-day transit SLA.
- **SEO:** semantic `<a>` links, `nav[aria-label="Coverage Directory"]`, per-route titles/descriptions/H1/canonical, and per-route BreadcrumbList structured data. `coverage/sitemap.xml` lists 66 URLs.

## File layout

| Path | Description |
| --- | --- |
| `src/coverageData.ts` | Typed schema, regions, corridors, hubs, capabilities, route helpers and quote endpoint |
| `src/coverage.ts` | Interactive SVG map, transitions, breadcrumbs, history, ZIP search and hover binding |
| `public/coverage.css` | Tactical UI styling and responsive layout |
| `public/states.json` | Bundled simplified actual U.S. state boundaries in EPSG:5070 projected SVG paths |
| `scripts/build.mjs` | Static-page SEO generator, copies runtime assets to deployment directory |
| `scripts/make_geometry.py` | Optional offline geometry generation (uses the Basemap UScounties shapefile) |
| `tests/coverage.test.mjs` | Automated data integrity and SEO page generation tests |
| `dist/coverage/` | Ready-to-deploy `/coverage` directory (created by `npm run build`) |

## Local usage

Requires Node 20+ and TypeScript (`tsc`) on `PATH`. No npm runtime libraries or package downloads are required for the generated website.

```bash
npm run build
npm test
python -m http.server 8080 --directory dist
# Open http://localhost:8080/coverage/
```

To test direct navigation, open `http://localhost:8080/coverage/west-coast/southern-california/gardena-ca/`.

## Website deployment

The accessible `Scapegoat-3PL/ScapeGoat` repository currently has static root files (`index.html`, `pricing.html`, etc.) and a `CNAME`, rather than a framework router or a `package.json`. The `/coverage` module therefore can be copied to a *new* root folder without changing the site's existing pages.

1. The repository workflow at `.github/workflows/build-coverage.yml` generates the **repository root** `coverage/` directory from this module after a push to the feature branch or main.
2. Merge only after the GitHub Actions run has succeeded and the generated pages are visible in the pull request. Confirm nested directory `index.html` pages work and preserve the existing `CNAME`.
3. Add a site navigation link as desired: `<a href="/coverage/">Freight Coverage Map</a>`.
4. Review the quote-form destination in `src/coverageData.ts` (`quoteUrl`) **before** publish. It currently points to the existing Jotform intake URL discussed in the project. It does not pre-fill a location or service selection.
5. Add or submit `https://scapegoat3plwarehouserates.com/coverage/sitemap.xml` to the primary sitemap or search-console configuration.
6. Run the acceptance tests below. Publishing is a separate action: merging the PR and GitHub Pages deploy are required before the public domain changes.

## Acceptance checklist

- Open the national route and confirm exactly 5 cards, real state boundaries and correct hover fading.
- Open all five region routes; confirm exactly 3 corridors per region and each corridor is selectable from the key and the supply-line map.
- For `/coverage/west-coast/southern-california/`, confirm **only** Gardena, Commerce and Riverside appear as selectable hubs.
- Open each of the 3 active SoCal hub pages; confirm coordinates, artery labels, exactly 3 capabilities, 25/250-mile radial rings, and `Request Lane Quote` link.
- Confirm Esc, right-click, browser Back/Forward, state input, ZIP input, and mobile split layout.
- Disable JavaScript and directly open deep links; inspect per-page title, meta description, H1 and crawlable directory links.
- Run `npm test`: 7 tests cover data constraints, 66 routes, SEO metadata, limits and geometry.

## Important specification gaps / publication caveats

- The brief assigns 43 of 48 contiguous states. **West Virginia, Montana, Wyoming, North Dakota and South Dakota remain visibly unassigned**, pending a business decision. The app does not imply coverage for them.
- Coordinates in the brief are treated as **hub points**, not precise facility addresses; no street addresses were supplied.
- Non-SoCal metros are illustrative **geographic directory markets**. Their displayed capabilities are requests for verification, not assertions of occupied facilities or available services.
- The brief's freight rail/freeway "supply lines" are schematic **corridor connectors** between hub points, not digitized route centerlines or a live carrier network.
- City-centroid search is not suitable for planning exact drayage distances. The 25/250-mile rings indicate radius only and cannot promise actual transit times or pricing.
- Fonts load from Google Fonts if permitted; system fonts are the fallback. ZIP lookup relies on a third-party API; state searches work locally.
- State geometry is generated from county boundary data bundled with Basemap and is simplified for a web SVG. Verify the data source's redistribution terms if extending this product commercially.