# Freight Coverage Map — GitHub integration

This module is self-contained. The existing ScapeGoat root website files and the existing CNAME are preserved.

- Editable TypeScript source: `freight-coverage/src/`
- Map geometry and CSS: `freight-coverage/public/`
- Tests and build script: `freight-coverage/tests/`, `freight-coverage/scripts/build.mjs`
- Generated, crawlable website: `coverage/` (66 HTML routes with sitemap)
- Automatic build: `.github/workflows/build-coverage.yml`

The workflow is intentionally scoped to the freight-coverage module. A push to the review branch or to `main` builds and tests the map, then commits the generated `coverage/` pages back to **that branch**. GitHub Pages can serve the directory after the generated pages reach `main`. The workflow requires Actions to be enabled and `contents: write` permission; check the Actions run before merging or publishing.

**Business verification before publishing:** The three Southern California hubs, named facilities, capabilities, provided coordinates, and service rings come from the provided requirements. The ring labels are radial illustrations, not guaranteed tariffs or transit commitments. Other metros are placeholders, not live warehouses. Five lower-48 states are unassigned. Review the quote CTA target (`https://form.jotform.com/262726330251147`) and the source of map boundary geometry before production publication.

To deploy through GitHub Pages, ensure the existing Pages source remains `main` / repository root and that `.nojekyll` is present only if needed for the hosting toolchain. After merge, verify `/coverage/`, `/coverage/west-coast/southern-california/`, and all three SoCal hub routes in a browser.