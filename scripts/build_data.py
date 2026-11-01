#!/usr/bin/env python3
"""
build_data.py — Derive the small JSON files the public pages read from content.json.

content.json (~5MB and growing ~30KB per publishing day) stays the single source
of truth: the publisher, the CMS admin and every Action keep reading/writing it.
Public pages no longer download it; they read these derived files instead:

    data/index.json                  settings (public part), categories, newest 5
                                     articles + episodes (nav, home), counts
    data/articles/<id>.json          one full article + 3 precomputed related stubs
    data/episodes/<id>.json          one full episode
    data/lists/articles-<n>.json     article list stubs, LIST_PAGE_SIZE per file, n=1 newest
    data/lists/episodes-<n>.json     episode list stubs, same paging
    data/categories/<id>.json        article + episode stubs for one category page
    data/pages/<key>.json            one static page (about / imprint / ai-podcast)

Never edit data/ by hand: it is rebuilt from scratch on every run, so files of
deleted items disappear too. Item order is content.json's array order (newest
first), exactly what the pages used to show.

Run locally:
    python3 scripts/build_data.py

Run by GitHub Actions whenever content.json changes (see regen-rss.yml) and by
guard-settings.yml when it restores a setting.
"""

import json
import math
import re
import shutil
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).parent.parent

LIST_PAGE_SIZE = 50   # items per data/lists/*.json file (the pages show 10 per "Load more")
LATEST_COUNT = 5      # newest articles/episodes in index.json (nav lists show 5)
RELATED_COUNT = 3

# Ids become file names: allow only what the current ids use, so an id can never
# point outside data/. An item with any other id is still listed but gets no file.
SAFE_ID = re.compile(r"^[A-Za-z0-9_-]+$")
_TAG = re.compile(r"<[^>]+>")


def _dump(path: Path, obj) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, ensure_ascii=False, separators=(",", ":")) + "\n",
                    encoding="utf-8")


def _cats(item: dict) -> list:
    return item.get("categories") or []


def article_stub(a: dict) -> dict:
    return {"id": a.get("id", ""), "title": a.get("title") or "",
            "categories": _cats(a), "pubDate": a.get("pubDate") or ""}


def episode_stub(e: dict) -> dict:
    return {"id": e.get("id", ""), "title": e.get("title") or "",
            "categories": _cats(e), "pubDate": e.get("pubDate") or "",
            "season": e.get("season"), "episodeNumber": e.get("episodeNumber")}


def related_articles(art: dict, articles: list) -> list:
    """Same rule the article page used to apply client-side: other articles sharing
    a category first, then any others, in array order; first RELATED_COUNT."""
    mine = set(_cats(art))
    others = [a for a in articles if a.get("id") != art.get("id")]
    same = [a for a in others if mine.intersection(_cats(a))]
    rest = [a for a in others if not mine.intersection(_cats(a))]
    return [{"id": a.get("id", ""), "title": a.get("title") or "", "categories": _cats(a),
             # plain text, already cut to what the related card shows
             "excerpt": _TAG.sub("", a.get("excerpt") or "")[:110]}
            for a in (same + rest)[:RELATED_COUNT]]


def _pages(items: list) -> list:
    return [items[i:i + LIST_PAGE_SIZE] for i in range(0, len(items), LIST_PAGE_SIZE)]


def build(data: dict, out: Path) -> dict:
    """Write every derived file into `out` (which must not exist yet). Returns counts."""
    articles = data.get("articles") or []
    episodes = data.get("episodes") or []
    categories = data.get("categories") or []
    settings = data.get("settings") or {}
    skipped = []

    def item_path(kind: str, item_id) -> Path:
        if isinstance(item_id, str) and SAFE_ID.match(item_id):
            return out / kind / f"{item_id}.json"
        skipped.append(f"{kind}:{item_id!r}")
        return None

    _dump(out / "index.json", {
        "version": data.get("version"),
        # Public settings only. The podcast block (feed metadata, tracking prefix)
        # is for the RSS writers and the admin, which read content.json directly.
        "settings": {"backgroundImage": settings.get("backgroundImage") or "",
                     "social": settings.get("social") or {}},
        "categories": categories,
        "latestArticles": [article_stub(a) for a in articles[:LATEST_COUNT]],
        "latestEpisodes": [{**episode_stub(e), "duration": e.get("duration"),
                            "audioUrl": e.get("audioUrl") or ""}
                           for e in episodes[:LATEST_COUNT]],
        "articleCount": len(articles),
        "episodeCount": len(episodes),
        "listPageSize": LIST_PAGE_SIZE,
        "articleListPages": math.ceil(len(articles) / LIST_PAGE_SIZE),
        "episodeListPages": math.ceil(len(episodes) / LIST_PAGE_SIZE),
    })

    for a in articles:
        p = item_path("articles", a.get("id"))
        if p:
            _dump(p, {**a, "related": related_articles(a, articles)})
    for e in episodes:
        p = item_path("episodes", e.get("id"))
        if p:
            _dump(p, e)

    article_rows = [{**article_stub(a), "excerpt": a.get("excerpt") or "",
                     "keywords": a.get("keywords") or ""} for a in articles]
    episode_rows = [{**episode_stub(e), "coverArt": e.get("coverArt") or "",
                     "notes": e.get("notes") or ""} for e in episodes]
    for n, chunk in enumerate(_pages(article_rows), 1):
        _dump(out / "lists" / f"articles-{n}.json", chunk)
    for n, chunk in enumerate(_pages(episode_rows), 1):
        _dump(out / "lists" / f"episodes-{n}.json", chunk)

    # One file per category id, including ids items reference but the category
    # list no longer has (the page then shows the raw id, as it always did).
    cat_ids = [c.get("id") for c in categories]
    cat_ids += sorted({c for item in articles + episodes for c in _cats(item)} - set(cat_ids))
    for cid in cat_ids:
        p = item_path("categories", cid)
        if p:
            _dump(p, {
                "articles": [{**article_stub(a), "excerpt": a.get("excerpt") or ""}
                             for a in articles if cid in _cats(a)],
                "episodes": [episode_stub(e) for e in episodes if cid in _cats(e)],
            })

    for key, html in (data.get("pages") or {}).items():
        p = item_path("pages", key)
        if p:
            _dump(p, {"content": html or ""})

    for s in skipped:
        print(f"  ⚠ unsafe id, no file written: {s}")
    return {"articles": len(articles), "episodes": len(episodes),
            "categories": len(cat_ids), "skipped": len(skipped)}


def main(argv: list) -> int:
    src = Path(argv[1]) if len(argv) > 1 else REPO_ROOT / "content.json"
    out = Path(argv[2]) if len(argv) > 2 else REPO_ROOT / "data"
    data = json.loads(src.read_text(encoding="utf-8"))
    if not isinstance(data.get("articles"), list) or not isinstance(data.get("episodes"), list):
        print(f"✗ {src} has no articles/episodes arrays — refusing to replace {out}")
        return 1

    # Build next to the target, then swap, so a crash never leaves a half-written
    # data/ behind for the commit step to pick up.
    tmp, old = out.with_name(out.name + ".tmp"), out.with_name(out.name + ".old")
    shutil.rmtree(tmp, ignore_errors=True)
    shutil.rmtree(old, ignore_errors=True)
    tmp.mkdir(parents=True)
    counts = build(data, tmp)
    if out.exists():
        out.rename(old)
    tmp.rename(out)
    shutil.rmtree(old, ignore_errors=True)

    files = sum(1 for _ in out.rglob("*.json"))
    size = (out / "index.json").stat().st_size
    print(f"✓ {out}: {files} files from {counts['articles']} articles, "
          f"{counts['episodes']} episodes, {counts['categories']} categories "
          f"(index.json {size:,} bytes)")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
