#!/usr/bin/env python3
"""
generate_rss.py — Generate podcast-feed.xml from content.json.

Run locally:
    python3 scripts/generate_rss.py

Run by GitHub Actions whenever content.json changes (see regen-rss.yml).
"""

import json
import re
import urllib.request
from email.utils import formatdate
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).parent.parent


def fetch_file_size(url: str) -> int:
    """Return Content-Length for an audio URL, or 0 on failure."""
    try:
        req = urllib.request.Request(
            url,
            method="HEAD",
            headers={"User-Agent": "Mozilla/5.0 (compatible; PodcastRSSBot/1.0)"},
        )
        with urllib.request.urlopen(req, timeout=15) as r:
            return int(r.headers.get("Content-Length", 0))
    except Exception as e:
        print(f"  ⚠ Could not fetch size for {url}: {e}")
        return 0


def seconds_to_hhmmss(seconds) -> str:
    if not seconds:
        return "00:00"
    s = int(seconds)
    h, m, s = s // 3600, (s % 3600) // 60, s % 60
    if h:
        return f"{h}:{m:02d}:{s:02d}"
    return f"{m}:{s:02d}"


def pubdate_to_rfc2822(date_str: str) -> str:
    """Convert YYYY-MM-DD to RFC 2822 format required by RSS."""
    try:
        dt = datetime.strptime(date_str, "%Y-%m-%d").replace(tzinfo=timezone.utc)
        return formatdate(dt.timestamp(), usegmt=True)
    except Exception:
        return formatdate(usegmt=True)


def escape_xml(text: str) -> str:
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
        .replace("'", "&apos;")
    )


def generate_rss(data: dict) -> str:
    settings = data.get("settings", {})
    pod = settings.get("podcast", {})

    site_url   = "https://europe-weekly.eu"
    feed_url   = f"{site_url}/podcast-feed.xml"
    title      = "Europe Weekly"
    desc       = pod.get("description") or "Europe Weekly Podcast"
    cover      = pod.get("coverArt") or f"https://audio.europe-weekly.eu/podcast-cover.jpg"
    category   = pod.get("category") or "News"
    prefix     = (pod.get("trackingPrefix") or "").rstrip("/")
    email      = "europeweekly27@gmail.com"

    def with_prefix(url: str) -> str:
        if not prefix or not url:
            return url
        return prefix + "/" + re.sub(r"^https?://", "", url)

    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<?xml-stylesheet type="text/xsl" href="podcast-feed.xsl"?>',
        '<rss version="2.0"',
        '     xmlns:itunes="http://www.itunes.com/dtds/podcast-1_0.dtd"',
        '     xmlns:atom="http://www.w3.org/2005/Atom"',
        '     xmlns:content="http://purl.org/rss/1.0/modules/content/">',
        "  <channel>",
        f"    <title>{escape_xml(title)}</title>",
        f"    <link>{site_url}</link>",
        f"    <description>{escape_xml(desc)}</description>",
        "    <language>en</language>",
        f"    <copyright>\u00a9 2026 {title}</copyright>",
        f'    <atom:link href="{feed_url}" rel="self" type="application/rss+xml"/>',
        f"    <itunes:author>{escape_xml(title)}</itunes:author>",
        "    <itunes:owner>",
        f"      <itunes:name>{escape_xml(title)}</itunes:name>",
        f"      <itunes:email>{email}</itunes:email>",
        "    </itunes:owner>",
        f'    <itunes:image href="{cover}"/>',
        "    <image>",
        f"      <url>{cover}</url>",
        f"      <title>{escape_xml(title)}</title>",
        f"      <link>{site_url}</link>",
        "    </image>",
        f"    <author>{escape_xml(title)}</author>",
        f"    <managingEditor>{email}</managingEditor>",
        "    <itunes:type>episodic</itunes:type>",
        f'    <itunes:category text="{escape_xml(category)}">',
        '      <itunes:category text="Politics"/>',
        "    </itunes:category>",
        "    <itunes:explicit>false</itunes:explicit>",
    ]

    episodes = data.get("episodes", [])
    print(f"Processing {len(episodes)} episode(s)…")

    for ep in episodes:
        audio_url = ep.get("audioUrl", "")
        tracked   = with_prefix(audio_url)

        print(f"  → {ep.get('episodeNumber', '?')}  {ep.get('title', '')[:50]}")
        size = fetch_file_size(audio_url) if audio_url else 0
        if size:
            print(f"     size: {size:,} bytes")

        ep_url  = f"{site_url}/episode.html?id={ep['id']}"
        pub     = pubdate_to_rfc2822(ep.get("pubDate", ""))
        dur     = seconds_to_hhmmss(ep.get("duration", 0))
        notes   = (ep.get("notes") or "").strip()
        ep_cover = ep.get("coverArt") or cover

        lines += [
            "    <item>",
            f"      <title>{escape_xml(ep.get('title', ''))}</title>",
            f"      <description>{escape_xml(notes or ep.get('title', ''))}</description>",
            f'      <enclosure url="{tracked}" length="{size}" type="audio/mpeg"/>',
            f"      <guid isPermaLink=\"false\">{ep['id']}</guid>",
            f"      <pubDate>{pub}</pubDate>",
            f"      <link>{ep_url}</link>",
            f"      <itunes:duration>{dur}</itunes:duration>",
            f"      <itunes:season>{ep.get('season', 1)}</itunes:season>",
            f"      <itunes:episode>{ep.get('episodeNumber', 1)}</itunes:episode>",
            f'      <itunes:image href="{ep_cover}"/>',
            "      <itunes:explicit>false</itunes:explicit>",
            "    </item>",
        ]

    lines += ["  </channel>", "</rss>"]
    return "\n".join(lines) + "\n"


def main():
    with open(REPO_ROOT / "content.json", encoding="utf-8") as f:
        data = json.load(f)

    xml = generate_rss(data)

    out = REPO_ROOT / "podcast-feed.xml"
    out.write_text(xml, encoding="utf-8")
    print(f"\n✓ Written {len(xml):,} chars to {out}")


if __name__ == "__main__":
    main()
