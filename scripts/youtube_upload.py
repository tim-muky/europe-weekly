#!/usr/bin/env python3
"""
youtube_upload.py — Auto-publish new Europe Weekly podcast episodes to YouTube.

Run by GitHub Actions whenever content.json changes.
Compares the current commit with the previous commit to find newly added
episodes, converts each MP3 to a 720p video (blurred cover background +
crisp cover art centred), and uploads it via the YouTube Data API v3.

Required environment variables (stored as GitHub Secrets):
  YOUTUBE_CLIENT_ID
  YOUTUBE_CLIENT_SECRET
  YOUTUBE_REFRESH_TOKEN
"""

import json
import os
import subprocess
import sys
import tempfile
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path


# ── Helpers ─────────────────────────────────────────────────────────────────

def get_access_token(client_id: str, client_secret: str, refresh_token: str) -> str:
    """Exchange a refresh token for a short-lived access token."""
    data = urllib.parse.urlencode({
        "client_id":     client_id,
        "client_secret": client_secret,
        "refresh_token": refresh_token,
        "grant_type":    "refresh_token",
    }).encode()
    req = urllib.request.Request(
        "https://oauth2.googleapis.com/token", data=data, method="POST"
    )
    try:
        with urllib.request.urlopen(req) as r:
            resp = json.loads(r.read())
    except urllib.error.HTTPError as e:
        body = e.read().decode(errors="replace")
        print(f"  ✗ Token exchange failed (HTTP {e.code}): {body}", file=sys.stderr)
        print(
            "\n  ⚠ If the error is 'invalid_grant', the refresh token has expired.\n"
            "    This happens when the Google Cloud project is in 'Testing' mode\n"
            "    (tokens expire after 7 days). Fix:\n"
            "    1. Go to Google Cloud Console → OAuth consent screen → change to 'Production'\n"
            "    2. Run: python3 scripts/get_youtube_token.py  (from the project directory)\n"
            "    3. Update the YOUTUBE_REFRESH_TOKEN secret in GitHub Settings → Secrets.",
            file=sys.stderr,
        )
        raise
    if "access_token" not in resp:
        print(f"  ✗ Unexpected token response: {resp}", file=sys.stderr)
        raise ValueError(f"No access_token in response: {resp}")
    return resp["access_token"]


def download(url: str, dest: Path) -> None:
    """Download a URL to a local file, following redirects."""
    urllib.request.urlretrieve(url, dest)


def create_video(cover: Path, audio: Path, out: Path) -> None:
    """
    Encode a 1280×720 MP4:
      • Blurred cover art fills the 16:9 background (blur sigma=25)
      • Crisp cover art (690 px tall) centred on top
    """
    subprocess.run(
        [
            "ffmpeg", "-y",
            "-loop", "1", "-i", str(cover),
            "-i", str(audio),
            "-filter_complex",
            (
                "[0:v]scale=1280:720:force_original_aspect_ratio=increase,"
                "crop=1280:720,gblur=sigma=25[bg];"
                "[0:v]scale=-1:690[fg];"
                "[bg][fg]overlay=(W-w)/2:(H-h)/2[out]"
            ),
            "-map", "[out]", "-map", "1:a",
            "-c:v", "libx264", "-preset", "fast", "-crf", "23",
            "-c:a", "aac", "-b:a", "192k",
            "-pix_fmt", "yuv420p",
            "-shortest",
            str(out),
        ],
        check=True,
    )


def build_title(ep: dict) -> str:
    """Europe Weekly S2E29 – Poland, Latvia, Lithuania – EU Daily Update"""
    base = (
        f"Europe Weekly S{ep.get('season', 1)}E{ep.get('episodeNumber', 1)}"
        f" \u2013 {ep['title']}"
    )
    return base[:97] + "\u2026" if len(base) > 100 else base


def build_description(ep: dict, social: dict) -> str:
    ep_url = f"https://europe-weekly.eu/episode.html?id={ep['id']}"
    notes  = (ep.get("notes") or "").strip()

    lines = []
    if notes:
        lines.append(notes)
        lines.append("")

    lines.append(f"\U0001f3a7 Listen & read more: {ep_url}")
    lines.append("")
    lines.append("\u2500" * 44)
    lines.append(
        "\U0001f30d Europe Weekly \u2014 European politics & international affairs,"
        " one country at a time."
    )
    lines.append("\U0001f514 Subscribe for new episodes daily")
    lines.append("")
    lines.append("\U0001f310 Website: https://europe-weekly.eu")

    instagram = social.get("instagram", "").strip()
    x_link    = social.get("x", "").strip()
    if instagram:
        lines.append(f"\U0001f4f8 Instagram: {instagram}")
    if x_link:
        lines.append(f"\U0001f426 X / Twitter: {x_link}")

    lines.append(
        "\U0001f3a7 Podcast RSS: https://europe-weekly.eu/podcast-feed.xml"
    )

    # Hashtags
    kws = [k.strip() for k in ep.get("keywords", "").split(",") if k.strip()]
    ht  = " ".join(
        "#" + k.replace(" ", "").replace("-", "") for k in kws[:6]
    )
    base_ht = "#EuropeWeekly #EuropeanPolitics #EuropeanUnion #Podcast #Europe"
    lines.append("")
    lines.append(f"{ht} {base_ht}".strip())

    return "\n".join(lines)


def build_tags(ep: dict) -> list:
    base = [
        "Europe Weekly", "European Politics", "European Union", "EU",
        "Podcast", "News", "Europe", "International Affairs",
    ]
    kws = [k.strip() for k in ep.get("keywords", "").split(",") if k.strip()]
    # YouTube accepts up to 500 chars of combined tags
    all_tags = base + [k for k in kws if k not in base]
    result, total = [], 0
    for tag in all_tags:
        if total + len(tag) + 1 > 490:
            break
        result.append(tag)
        total += len(tag) + 1
    return result


def upload_to_youtube(
    access_token: str,
    video_path: Path,
    title: str,
    description: str,
    tags: list,
) -> str:
    """
    Upload video via YouTube's resumable upload API.
    Returns the YouTube video ID.
    """
    video_size = os.path.getsize(video_path)

    metadata = {
        "snippet": {
            "title":           title,
            "description":     description,
            "tags":            tags,
            "categoryId":      "25",   # News & Politics
            "defaultLanguage": "en",
        },
        "status": {
            "privacyStatus":            "public",
            "selfDeclaredMadeForKids":  False,
        },
    }

    # Step 1 — initiate resumable session
    init_url = (
        "https://www.googleapis.com/upload/youtube/v3/videos"
        "?uploadType=resumable&part=snippet,status"
    )
    req = urllib.request.Request(
        init_url,
        data=json.dumps(metadata).encode(),
        headers={
            "Authorization":          f"Bearer {access_token}",
            "Content-Type":           "application/json; charset=UTF-8",
            "X-Upload-Content-Type":  "video/mp4",
            "X-Upload-Content-Length": str(video_size),
        },
        method="POST",
    )
    with urllib.request.urlopen(req) as r:
        upload_url = r.headers["Location"]

    # Step 2 — stream the file in 50 MB chunks
    CHUNK = 50 * 1024 * 1024
    with open(video_path, "rb") as f:
        start = 0
        while True:
            chunk = f.read(CHUNK)
            if not chunk:
                break
            end = start + len(chunk) - 1
            upload_req = urllib.request.Request(
                upload_url,
                data=chunk,
                headers={
                    "Content-Type":   "video/mp4",
                    "Content-Length": str(len(chunk)),
                    "Content-Range":  f"bytes {start}-{end}/{video_size}",
                },
                method="PUT",
            )
            try:
                with urllib.request.urlopen(upload_req) as r:
                    return json.loads(r.read())["id"]
            except urllib.error.HTTPError as e:
                if e.code == 308:       # Resume Incomplete — more chunks to send
                    start = end + 1
                    continue
                raise


# ── Main ─────────────────────────────────────────────────────────────────────

def main():
    # ── 1. Find newly added episodes ──────────────────────────────────────────
    prev = subprocess.run(
        ["git", "show", "HEAD^:content.json"],
        capture_output=True, text=True,
    )
    with open("content.json", encoding="utf-8") as f:
        curr = json.load(f)

    prev_ids: set[str] = set()
    if prev.returncode == 0:
        try:
            prev_ids = {ep["id"] for ep in json.loads(prev.stdout).get("episodes", [])}
        except Exception:
            pass

    new_episodes = [
        ep for ep in curr.get("episodes", [])
        if ep["id"] not in prev_ids and ep.get("audioUrl")
    ]

    if not new_episodes:
        print("No new episodes found — nothing to upload.")
        return

    print(f"Found {len(new_episodes)} new episode(s) to upload.")

    # ── 2. Authenticate ───────────────────────────────────────────────────────
    client_id     = os.environ["YOUTUBE_CLIENT_ID"]
    client_secret = os.environ["YOUTUBE_CLIENT_SECRET"]
    refresh_token = os.environ["YOUTUBE_REFRESH_TOKEN"]
    access_token  = get_access_token(client_id, client_secret, refresh_token)
    print("YouTube access token obtained.")

    social = curr.get("settings", {}).get("social", {})
    fallback_cover = "https://audio.europe-weekly.eu/podcast-cover.jpg"

    # ── 3. Process each new episode ───────────────────────────────────────────
    for ep in new_episodes:
        print(f"\n{'─'*60}")
        print(f"Episode: {ep['title']}")

        with tempfile.TemporaryDirectory() as tmp:
            tmp = Path(tmp)

            # Download audio
            print(f"  ↓ Audio: {ep['audioUrl']}")
            audio = tmp / "audio.mp3"
            download(ep["audioUrl"], audio)

            # Download cover art
            cover_url = ep.get("coverArt") or fallback_cover
            print(f"  ↓ Cover: {cover_url}")
            cover = tmp / "cover.jpg"
            download(cover_url, cover)

            # Create video
            print("  ⚙ Encoding video (blurred bg + centred cover)…")
            video = tmp / "video.mp4"
            create_video(cover, audio, video)
            size_mb = os.path.getsize(video) / 1024 / 1024
            print(f"  ✓ Video encoded ({size_mb:.1f} MB)")

            # Build metadata
            title       = build_title(ep)
            description = build_description(ep, social)
            tags        = build_tags(ep)

            print(f"  ↑ Uploading: {title}")
            video_id = upload_to_youtube(
                access_token, video, title, description, tags
            )
            print(f"  ✓ Published: https://youtu.be/{video_id}")

    print(f"\n{'─'*60}")
    print("All done.")


if __name__ == "__main__":
    main()
