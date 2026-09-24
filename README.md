# Anime2Manga

Static website hosted on GitHub Pages. Every series URL has a generated HTML
page with its own title, description and canonical URL. The shared interface
stays in `index.html`, and `build_pages.py` refreshes the series pages.

## Where to edit

- `data/<series-id>.json`: episode, chapter, volume, cover and publisher data.
- `data/series-order.json`: IDs of the available series.
- `app.js`: episode/volume lookup and result rendering.
- `navigation.js`: navigation, home search and analytics.
- `styles.css`: all site styles.
- `index.html`: shared page markup and home page content.
- `build_pages.py`: creates `series-data.js` and the 20 series HTML pages.

`series-data.js` and each `<series>/index.html` are generated. Edit the JSON
or `index.html` and rebuild, rather than editing those generated files.

## Build and check

```sh
python3 build_pages.py
node tests/volume-lookup.test.cjs
```

The build also updates version hashes in `index.html` and all series pages to
avoid serving stale CSS or JavaScript after a change. Upload the generated
files together with any edited JSON or source files. Existing series pages
remain ordinary HTML so Google can read their title, description and canonical
URL without running JavaScript.

For the first upload of this refactor, extract the archive locally and upload
its contents to the repository root while preserving the folders. GitHub does
not unpack a ZIP uploaded as a single file. The old `base.css`,
`community-redesign.css`, and `series-guide.js` are unused by the new pages;
they can be deleted from GitHub after all new assets and pages are present.
