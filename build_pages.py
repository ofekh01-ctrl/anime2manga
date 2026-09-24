#!/usr/bin/env python3
"""
Generates the per-series pages (bleach/index.html, naruto/index.html, ...)
from the main index.html. All pages share the same CSS and JavaScript files.

Every series page is a copy of index.html with only the SEO <head> values
changed (canonical, title, description, og/twitter tags, JSON-LD WebPage).
Run this after every change to index.html:

    python3 build_pages.py

To add a series: add its folder to PAGES below, and add the URL to sitemap.xml.
"""
import hashlib
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
SITE = 'https://anime2manga.net'

GENERIC_TITLE = 'Anime Episode to Manga Chapter Converter | Anime2Manga'
GENERIC_DESC = ('Easily convert anime episodes to manga chapters and volumes. '
                'Find exactly where to continue reading your favorite anime series.')

# folder -> (title, description). description None = keep the generic one.
PAGES = {
    'attack-on-titan': ('Attack on Titan Manga to Anime Converter | Anime2Manga',
        'Match Attack on Titan manga chapters and volumes with anime episodes and find exactly where to continue between the anime and manga.'),
    'bleach': ('Bleach Manga to Anime Converter | Anime2Manga',
        'Match Bleach manga chapters and volumes with anime episodes, identify filler, and find where to continue between the anime and manga.'),
    'black-clover': ('Black Clover Anime to Manga Converter | Anime2Manga',
        'Match Black Clover anime episodes with manga chapters and volumes, see filler, and find where to continue reading after episode 170.'),
    'blue-lock': ('Blue Lock Manga to Anime Converter | Anime2Manga',
        'Match Blue Lock manga chapters and volumes with anime episodes, see the current story arc, and find exactly where to continue after the anime.'),
    'chainsaw-man': ('Chainsaw Man Manga to Anime Converter | Anime2Manga',
        'Match Chainsaw Man manga chapters and volumes with anime episodes and find exactly where to continue reading after the anime.'),
    'dandadan': ('Dandadan Manga to Anime Converter | Anime2Manga',
        'Match Dandadan manga chapters and volumes with anime episodes and find exactly where to continue reading after the anime.'),
    'death-note': ('Death Note Manga to Anime Converter | Anime2Manga',
        'Match Death Note manga chapters and volumes with anime episodes and find exactly where to continue between the anime and manga.'),
    'demon-slayer': ('Demon Slayer Anime to Manga Converter | Anime2Manga',
        'Match Demon Slayer anime episodes with manga chapters and volumes, identify filler, and find where to continue reading.'),
    'dragon-ball': ('Dragon Ball Manga to Anime Converter | Anime2Manga',
        'Match Dragon Ball and Dragon Ball Z manga chapters and volumes with anime episodes, identify filler, and find exactly where to continue reading.'),
    'frieren': ('Frieren Anime to Manga Converter | Anime2Manga',
        'Match Frieren: Beyond Journey’s End episodes 1–38 to manga chapters and VIZ volumes. Continue reading from chapter 81 in volume 9.'),
    'fullmetal-alchemist': ('Fullmetal Alchemist: Brotherhood Manga Converter | Anime2Manga',
        'Match Fullmetal Alchemist: Brotherhood episodes with manga chapters and the original 27 manga volumes.'),
    'gachiakuta': ('Gachiakuta Anime to Manga Converter | Anime2Manga',
        'Convert Gachiakuta season 1 episodes to manga chapters and Kodansha English volumes, and find where to continue reading.'),
    'hunter-x-hunter': ('Hunter × Hunter Manga to Anime Converter | Anime2Manga',
        'Match Hunter × Hunter manga chapters and volumes with anime episodes, identify filler, and find where to continue reading.'),
    'jujutsu-kaisen': ('Jujutsu Kaisen Manga to Anime Converter | Anime2Manga',
        'Match Jujutsu Kaisen manga chapters and volumes with anime episodes and find exactly where to continue reading.'),
    'naruto': ('Naruto Anime to Manga Converter | Naruto & Shippuden | Anime2Manga',
        'Convert Naruto and Naruto: Shippuden episodes to manga chapters and volumes, check filler, and find exactly where to continue reading.'),
    'my-hero-academia': ('My Hero Academia Anime to Manga Converter | Anime2Manga',
        'Match My Hero Academia episodes, including the final TV special, with manga chapters and all 42 volumes.'),
    'one-piece': ('One Piece Manga to Anime Converter | Anime2Manga',
        'Convert One Piece anime episodes to manga chapters and volumes, check filler, identify story arcs, and find exactly where to continue reading.'),
    'one-punch-man': ('One Punch Man Anime to Manga Converter | Anime2Manga',
        'Match One Punch Man TV episodes across seasons 1–3 with manga chapters and VIZ volumes, and find where to continue reading.'),
    'spy-x-family': ('Spy x Family Anime to Manga Converter | Anime2Manga',
        'Match Spy x Family episodes 1–50 to manga chapters and VIZ volumes. Continue reading from chapter 88 in volume 13.'),
    'vinland-saga': ('Vinland Saga Anime to Manga Converter | Anime2Manga',
        'Convert Vinland Saga anime episodes to manga chapters and original volumes, view story arcs, and find where to continue after Season 2.'),
}


def version_shared_assets(html):
    """Refresh shared asset URLs when their contents change, avoiding stale browser caches."""
    for name in ('base.css', 'community-redesign.css', 'navigation.js', 'series-guide.js'):
        data = open(os.path.join(HERE, name), 'rb').read()
        version = hashlib.sha256(data).hexdigest()[:8]
        pattern = rf'/{re.escape(name)}(?:\?v=[^"\s]*)?'
        html, count = re.subn(pattern, f'/{name}?v={version}', html)
        if count != 1:
            sys.exit(f'build_pages: expected 1 reference to {name}, found {count}')
    return html


def replace_once(text, old, new):
    if text.count(old) != 1:
        sys.exit(f'build_pages: expected exactly 1 match for {old[:70]!r}, found {text.count(old)}')
    return text.replace(old, new)


def build(root_html, folder, title, desc):
    url = f'{SITE}/{folder}/'
    marker = '<link href="/assets/favicon.png"'
    cut = root_html.index(marker)          # everything before this is <head> SEO
    head, rest = root_html[:cut], root_html[cut:]
    desc = desc or GENERIC_DESC

    head = replace_once(head, f'<link href="{SITE}/" rel="canonical"/>',
                              f'<link href="{url}" rel="canonical"/>')
    head = replace_once(head, f'<meta content="{SITE}/" property="og:url"/>',
                              f'<meta content="{url}" property="og:url"/>')
    head = replace_once(head, f'"@id": "{SITE}/#webpage",\n      "url": "{SITE}/",',
                              f'"@id": "{url}#webpage",\n      "url": "{url}",')
    # title appears in <title>, og:title, twitter:title and the JSON-LD WebPage name
    head = head.replace(GENERIC_TITLE, title)
    # description appears in meta, og, twitter and the JSON-LD WebPage description
    head = head.replace(GENERIC_DESC, desc)
    return head + rest


def main():
    src = os.path.join(HERE, 'index.html')
    root_html = open(src, encoding='utf8').read()
    versioned_html = version_shared_assets(root_html)
    if versioned_html != root_html:
        with open(src, 'w', encoding='utf8', newline='') as f:
            f.write(versioned_html)
        root_html = versioned_html
    for folder, (title, desc) in PAGES.items():
        out_dir = os.path.join(HERE, folder)
        os.makedirs(out_dir, exist_ok=True)
        with open(os.path.join(out_dir, 'index.html'), 'w', encoding='utf8', newline='') as f:
            f.write(build(root_html, folder, title, desc))
        print('built', folder + '/index.html')


if __name__ == '__main__':
    main()
