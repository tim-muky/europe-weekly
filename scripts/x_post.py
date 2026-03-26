#!/usr/bin/env python3
"""
x_post.py — Auto-post new Europe Weekly articles to X (Twitter).

Run by GitHub Actions whenever content.json changes.
Compares the current commit with the previous commit to find newly added
articles, uses Claude to generate engaging tweet text with hashtags,
and posts each article to X with a 20-minute delay between posts.

If a podcast episode was published on the same day, its link is included.

Required environment variables (stored as GitHub Secrets):
  X_API_KEY
  X_API_SECRET
  X_ACCESS_TOKEN
  X_ACCESS_TOKEN_SECRET
  ANTHROPIC_API_KEY
"""

import json
import os
import subprocess
import sys
import time

# ── Helpers ─────────────────────────────────────────────────────────────────

DELAY_SECONDS = 20 * 60  # 20 minutes between posts


def find_new_articles(curr: dict, prev_ids: set) -> list:
    """Return articles present in curr but not in prev_ids."""
    return [
        art for art in curr.get("articles", [])
        if art["id"] not in prev_ids
        and art["id"].startswith("article-")
    ]


def find_todays_episode(curr: dict, pub_date: str) -> dict | None:
    """Find a podcast episode published on the given date."""
    for ep in curr.get("episodes", []):
        if ep.get("pubDate") == pub_date and ep.get("audioUrl"):
            return ep
    return None


def generate_tweet_text(article: dict, episode: dict | None, anthropic_api_key: str) -> str:
    """Use Claude to generate a short tweet with hashtags."""
    import urllib.request
    import urllib.error

    article_url = f"https://europe-weekly.eu/article.html?id={article['id']}"

    episode_context = ""
    episode_url = ""
    if episode:
        episode_url = f"https://europe-weekly.eu/episode.html?id={episode['id']}"
        episode_context = (
            f"\n\nToday's podcast episode: \"{episode['title']}\""
            f"\nEpisode URL: {episode_url}"
        )

    prompt = f"""Write a tweet for the Europe Weekly X account (@europeweeklypod) about this article.

ARTICLE TITLE: {article['title']}
ARTICLE EXCERPT: {article.get('excerpt', '')}
ARTICLE BODY: {article.get('body', '')[:1500]}
ARTICLE URL: {article_url}
ARTICLE KEYWORDS: {article.get('keywords', '')}
{episode_context}

RULES:
- Write 1-2 engaging sentences summarising the article's key point
- End with the article URL on its own line
{"- On the NEXT line, add the podcast episode URL with a 🎧 emoji prefix" if episode else ""}
- After the URLs, add 3-5 relevant hashtags (always include #EuropeWeekly)
- Keep the total tweet under 280 characters (including URL and hashtags)
- Do NOT use quotation marks around the entire tweet
- Write in a professional news tone
- Output ONLY the tweet text, nothing else"""

    body = json.dumps({
        "model": "claude-haiku-4-5-20251001",
        "max_tokens": 300,
        "messages": [{"role": "user", "content": prompt}],
    }).encode()

    req = urllib.request.Request(
        "https://api.anthropic.com/v1/messages",
        data=body,
        headers={
            "x-api-key": anthropic_api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        },
        method="POST",
    )

    with urllib.request.urlopen(req) as r:
        resp = json.loads(r.read())

    return resp["content"][0]["text"].strip()


def post_to_x(
    tweet_text: str,
    api_key: str,
    api_secret: str,
    access_token: str,
    access_token_secret: str,
) -> str:
    """Post a tweet via X API v2. Returns the tweet ID."""
    import tweepy

    client = tweepy.Client(
        consumer_key=api_key,
        consumer_secret=api_secret,
        access_token=access_token,
        access_token_secret=access_token_secret,
    )

    response = client.create_tweet(text=tweet_text)
    tweet_id = response.data["id"]
    return tweet_id


# ── Main ─────────────────────────────────────────────────────────────────────

def main():
    # ── 1. Find newly added articles ────────────────────────────────────────
    prev = subprocess.run(
        ["git", "show", "HEAD^:content.json"],
        capture_output=True, text=True,
    )
    with open("content.json", encoding="utf-8") as f:
        curr = json.load(f)

    prev_ids: set[str] = set()
    if prev.returncode == 0:
        try:
            prev_ids = {
                art["id"] for art in json.loads(prev.stdout).get("articles", [])
            }
        except Exception:
            pass

    new_articles = find_new_articles(curr, prev_ids)

    if not new_articles:
        print("No new articles found — nothing to post.")
        return

    # Reverse so oldest article posts first (newest will post last)
    new_articles = list(reversed(new_articles))
    print(f"Found {len(new_articles)} new article(s) to post to X.")

    # ── 2. Check for required secrets ───────────────────────────────────────
    required = [
        "X_API_KEY", "X_API_SECRET",
        "X_ACCESS_TOKEN", "X_ACCESS_TOKEN_SECRET",
        "ANTHROPIC_API_KEY",
    ]
    missing = [v for v in required if not os.environ.get(v)]
    if missing:
        print(f"✗ Missing required environment variables: {', '.join(missing)}", file=sys.stderr)
        print("  Set them as GitHub Secrets under Settings → Secrets → Actions.", file=sys.stderr)
        sys.exit(1)

    api_key              = os.environ["X_API_KEY"]
    api_secret           = os.environ["X_API_SECRET"]
    access_token         = os.environ["X_ACCESS_TOKEN"]
    access_token_secret  = os.environ["X_ACCESS_TOKEN_SECRET"]
    anthropic_api_key    = os.environ["ANTHROPIC_API_KEY"]

    # ── 3. Find today's episode (if any) ────────────────────────────────────
    # Use the pubDate of the first new article to find a matching episode
    pub_date = new_articles[0].get("pubDate", "")
    episode = find_todays_episode(curr, pub_date) if pub_date else None
    if episode:
        print(f"Today's episode: S{episode.get('season')}E{episode.get('episodeNumber')} – {episode['title']}")
    else:
        print("No podcast episode found for today.")

    # ── 4. Generate and post tweets ─────────────────────────────────────────
    for i, article in enumerate(new_articles):
        print(f"\n{'─' * 60}")
        print(f"Article {i + 1}/{len(new_articles)}: {article['title']}")

        # Wait between posts (skip wait for the first one)
        if i > 0:
            print(f"  ⏳ Waiting {DELAY_SECONDS // 60} minutes before next post…")
            time.sleep(DELAY_SECONDS)

        # Generate tweet text
        print("  🤖 Generating tweet with Claude…")
        tweet_text = generate_tweet_text(article, episode, anthropic_api_key)
        print(f"  📝 Tweet:\n{tweet_text}\n")

        # Post to X
        print("  ↑ Posting to X…")
        tweet_id = post_to_x(
            tweet_text, api_key, api_secret, access_token, access_token_secret
        )
        print(f"  ✓ Posted: https://x.com/europeweeklypod/status/{tweet_id}")

    print(f"\n{'─' * 60}")
    print("All done.")


if __name__ == "__main__":
    main()
