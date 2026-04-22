# Europe Weekly – Clawbot Publishing Instructions

Instructions for an AI agent or automated workflow to publish new Articles and Episodes to the Europe Weekly website. Execute every step in the exact order given. Do not skip steps or modify any file other than `content.json`.

---

## Prerequisites

The following must be available in the agent's environment before starting:

| What | Value |
|---|---|
| Repository URL | `https://github.com/tim-muky/europe-weekly` |
| Local clone path | Any local directory, e.g. `/tmp/europe-weekly` |
| GitHub PAT | Classic token with full `repo` scope. Never use fine-grained tokens. |
| Python 3 or Node.js | For JSON manipulation and git commands |

**Deployment model:** Cloudflare Pages is connected directly to the GitHub repository. Every push to the `main` branch automatically triggers a new deployment — **the bot does not need to run any Cloudflare commands**. A GitHub push is the only publish action required.

> **If auto-deployment is broken** (Cloudflare dashboard shows "The repository cannot be accessed"): delete the Pages project and recreate it via the Cloudflare dashboard (Workers & Pages → Create application → Pages → Connect to Git → `tim-muky/europe-weekly`, branch `main`, build command empty, build output empty). Then re-attach the custom domain `europe-weekly.eu` in the project's Custom Domains tab.
>
> Until the integration is restored, use the manual wrangler fallback documented at the end of Step 9.

---

## ⚠️ Critical rule — always start from the live GitHub copy

**Never read a locally cached `content.json` without pulling from GitHub first.**
The admin CMS pushes settings (YouTube URL, Download Tracking Prefix, AI-PODCAST page) directly to GitHub via the API. If you skip the pull, those settings will be silently wiped and the guard-settings workflow will have to restore them — causing an extra commit and potential confusion.

**If publishing from the working directory** (`/Users/timmeyerdierks/Claude/Europe weekly project`), run `git pull origin main` before touching `content.json`. If publishing from a temp clone, the clone/pull in Step 1 already satisfies this requirement.

---

## Step 1 — Fetch the current content.json

**Why:** Always start from the latest published file so no previous edits are lost. Never edit a locally cached copy.

**What you get:** A JSON object containing `version`, `settings`, `pages`, `categories`, `articles`, and `episodes`.

### Bash
```bash
REPO_DIR="/tmp/europe-weekly"

# Clone the repo if it doesn't exist locally
if [ ! -d "$REPO_DIR/.git" ]; then
  git clone https://TOKEN@github.com/tim-muky/europe-weekly.git "$REPO_DIR"
fi

# Pull latest changes
cd "$REPO_DIR"
git pull origin main

# content.json is now at $REPO_DIR/content.json
```

### Python
```python
import subprocess, json, os

REPO_DIR = "/tmp/europe-weekly"
CONTENT_FILE = os.path.join(REPO_DIR, "content.json")

# Clone if not present, otherwise pull
if not os.path.isdir(os.path.join(REPO_DIR, ".git")):
    subprocess.run(
        ["git", "clone", "https://TOKEN@github.com/tim-muky/europe-weekly.git", REPO_DIR],
        check=True
    )
else:
    subprocess.run(["git", "-C", REPO_DIR, "pull", "origin", "main"], check=True)

# Parse
with open(CONTENT_FILE, "r", encoding="utf-8") as f:
    data = json.load(f)

print(f"Loaded content.json — version: {data['version']}")
print(f"  Articles : {len(data['articles'])}")
print(f"  Episodes : {len(data['episodes'])}")
print(f"  Categories: {[c['label'] for c in data['categories']]}")
```

### JavaScript (Node.js)
```javascript
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const REPO_DIR = "/tmp/europe-weekly";
const CONTENT_FILE = path.join(REPO_DIR, "content.json");

// Clone if not present, otherwise pull
if (!fs.existsSync(path.join(REPO_DIR, ".git"))) {
  execSync(`git clone https://TOKEN@github.com/tim-muky/europe-weekly.git ${REPO_DIR}`);
} else {
  execSync(`git -C ${REPO_DIR} pull origin main`);
}

// Parse
const data = JSON.parse(fs.readFileSync(CONTENT_FILE, "utf-8"));

console.log(`Loaded content.json — version: ${data.version}`);
console.log(`  Articles : ${data.articles.length}`);
console.log(`  Episodes : ${data.episodes.length}`);
console.log(`  Categories: ${data.categories.map(c => c.label).join(", ")}`);
```

**Expected data structure after parsing:**
```json
{
  "version": 1741694400000,
  "settings": {
    "backgroundImage": "",
    "social": { "instagram": "", "x": "", "youtube": "" },
    "podcast": {
      "title": "Europe Weekly",
      "description": "Independent media covering European politics, economics, and culture.",
      "coverArt": "https://audio.europe-weekly.eu/podcast-cover.jpg",
      "author": "Europe Weekly",
      "email": "contact@europe-weekly.eu",
      "category": "News",
      "language": "en"
    }
  },
  "pages": { "about": "...", "imprint": "..." },
  "categories": [
    { "id": "cat-1", "label": "country category 1" }
  ],
  "articles": [ { "id": "article-1", "title": "...", ... } ],
  "episodes": [
    {
      "id": "episode-1", "title": "...", "pubDate": "2026-03-12",
      "duration": 1320, "audioUrl": "https://audio.europe-weekly.eu/episode-1.mp3",
      "coverArt": "", "season": 1, "episodeNumber": 1,
      "keywords": "", "notes": "", "categories": []
    }
  ]
}
```

---

## Step 2 — Read the existing categories

**Why:** The `categories` array defines all valid topic tags. You must pick IDs from this list — never invent new ones. The labels help you decide which categories apply to the new post.

**What you get:** A mapping of label → ID to use when building the new post object.

### Python
```python
# Build a lookup dict: label (lowercase) → id
category_map = {c["label"].lower(): c["id"] for c in data["categories"]}
category_ids = [c["id"] for c in data["categories"]]

print("Available categories:")
for c in data["categories"]:
    print(f"  id={c['id']}  label={c['label']}")

# Example: select categories relevant to the new post topic
# Replace with logic that matches your content to available labels
post_topic_keywords = ["economy", "germany"]  # derived from the post content
selected_ids = []
for c in data["categories"]:
    if any(kw in c["label"].lower() for kw in post_topic_keywords):
        selected_ids.append(c["id"])

# Fallback: use [] if nothing matches
print(f"Selected category IDs: {selected_ids}")
```

### JavaScript (Node.js)
```javascript
// Build a lookup map: label (lowercase) → id
const categoryMap = Object.fromEntries(
  data.categories.map(c => [c.label.toLowerCase(), c.id])
);
const categoryIds = data.categories.map(c => c.id);

console.log("Available categories:");
data.categories.forEach(c => console.log(`  id=${c.id}  label=${c.label}`));

// Example: select categories relevant to the new post topic
const postTopicKeywords = ["economy", "germany"];
const selectedIds = data.categories
  .filter(c => postTopicKeywords.some(kw => c.label.toLowerCase().includes(kw)))
  .map(c => c.id);

console.log(`Selected category IDs: ${selectedIds}`);
```

**Rules:**
- Only use `"id"` values that already exist in `data.categories`. Never use the label string as the ID.
- Use `[]` if no category matches the post topic.
- You may select multiple IDs: `["cat-1", "cat-3"]`.
- Do not add or modify the `categories` array itself during a normal publish — see **Step 2b** if you need to create a new category first.

---

## Step 2b — Adding or removing a category (optional)

**Why:** Categories are the yellow tag pills shown on articles and episodes, each linking to a filtered category page. You must add a category to `data.categories` before you can assign it to any article or episode.

**When to use:** Only when you need a category that does not already exist. If all required categories are present, skip to Step 3.

### Category object structure

```json
{ "id": "cat-germany", "label": "Germany" }
```

| Field | Rules |
|---|---|
| `id` | `"cat-"` + short lowercase slug, e.g. `"cat-de"`, `"cat-nato"`, `"cat-eu-economy"`. Use only `a-z`, `0-9`, `-`. **Never reuse or change an existing id.** |
| `label` | Human-readable display name shown as a tag on the site, e.g. `"Germany"`, `"Defence"`, `"EU Economy"`. |

### Adding a new category — Python

```python
import re

def add_category(data, label):
    """
    Add a new category to data["categories"] and return its id.
    Call this BEFORE build_article() / build_episode() if the category is new.
    """
    slug = re.sub(r"[^a-z0-9]+", "-", label.lower()).strip("-")
    new_id = f"cat-{slug}"

    existing_ids = {c["id"] for c in data["categories"]}
    if new_id in existing_ids:
        counter = 2
        while f"cat-{slug}-{counter}" in existing_ids:
            counter += 1
        new_id = f"cat-{slug}-{counter}"

    data["categories"].append({"id": new_id, "label": label})
    print(f"Added category: id={new_id}  label={label}")
    return new_id

# Example
new_cat_id = add_category(data, "Defence")
# → new_cat_id = "cat-defence"
# Use new_cat_id in selected_ids when building the article/episode
```

### Adding a new category — JavaScript (Node.js)

```javascript
function addCategory(data, label) {
  const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  let newId = `cat-${slug}`;

  const existingIds = new Set(data.categories.map(c => c.id));
  if (existingIds.has(newId)) {
    let counter = 2;
    while (existingIds.has(`cat-${slug}-${counter}`)) counter++;
    newId = `cat-${slug}-${counter}`;
  }

  data.categories.push({ id: newId, label });
  console.log(`Added category: id=${newId}  label=${label}`);
  return newId;
}

// Example
const newCatId = addCategory(data, "Defence");
// → newCatId = "cat-defence"
// Use newCatId in selectedIds when building the article/episode
```

### Assigning categories to articles and episodes

The `categories` field on each article/episode is an **array of `id` strings**. Every id must exist in `data.categories`.

```json
"categories": ["cat-germany", "cat-nato"]
```

- Categories render as yellow tag pills on the homepage, article pages, episode pages, and list pages.
- Each tag links to `/category.html?id=<category-id>` showing all content with that tag.
- An article or episode can have **zero, one, or many** categories. Use `[]` to show no tags.
- To assign a new category created in this step, add its `id` to the `categories` array of the article/episode object in Step 4.

### Removing a category

Removing a category is a **two-step operation** — you must clean up all references first:

```python
cat_id_to_remove = "cat-old-topic"

# 1. Remove from all articles
for a in data["articles"]:
    a["categories"] = [c for c in a.get("categories", []) if c != cat_id_to_remove]

# 2. Remove from all episodes
for e in data["episodes"]:
    e["categories"] = [c for c in e.get("categories", []) if c != cat_id_to_remove]

# 3. Remove from the categories list itself
data["categories"] = [c for c in data["categories"] if c["id"] != cat_id_to_remove]
```

```javascript
const catIdToRemove = "cat-old-topic";

// 1. Remove from all articles
data.articles.forEach(a => {
  a.categories = (a.categories || []).filter(id => id !== catIdToRemove);
});

// 2. Remove from all episodes
data.episodes.forEach(e => {
  e.categories = (e.categories || []).filter(id => id !== catIdToRemove);
});

// 3. Remove from the categories list itself
data.categories = data.categories.filter(c => c.id !== catIdToRemove);
```

---

## Step 3 — Generate a unique ID

**Why:** Every article and episode needs a stable unique identifier used in URLs (`article.html?id=X` and `episode.html?id=X`). Once published, an ID must never change.

**Format:**
- Article: `"article-"` + 7 random lowercase alphanumeric characters → e.g. `"article-k4e9x2m"`
- Episode: `"episode-"` + 7 random lowercase alphanumeric characters → e.g. `"episode-r7w1t8p"`

### Python
```python
import random, string

def generate_id(prefix, existing_ids):
    chars = string.ascii_lowercase + string.digits
    while True:
        suffix = "".join(random.choices(chars, k=7))
        new_id = f"{prefix}{suffix}"
        if new_id not in existing_ids:
            return new_id

# Collect all existing IDs
existing_article_ids = {a["id"] for a in data["articles"]}
existing_episode_ids = {e["id"] for e in data["episodes"]}

# Generate
new_article_id = generate_id("article-", existing_article_ids)
new_episode_id = generate_id("episode-", existing_episode_ids)

print(f"New article ID : {new_article_id}")   # e.g. article-k4e9x2m
print(f"New episode ID : {new_episode_id}")   # e.g. episode-r7w1t8p
```

### JavaScript (Node.js)
```javascript
function generateId(prefix, existingIds) {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let id;
  do {
    const suffix = Array.from({ length: 7 }, () =>
      chars[Math.floor(Math.random() * chars.length)]
    ).join("");
    id = `${prefix}${suffix}`;
  } while (existingIds.has(id));
  return id;
}

// Collect all existing IDs
const existingArticleIds = new Set(data.articles.map(a => a.id));
const existingEpisodeIds = new Set(data.episodes.map(e => e.id));

// Generate
const newArticleId = generateId("article-", existingArticleIds);
const newEpisodeId = generateId("episode-", existingEpisodeIds);

console.log(`New article ID : ${newArticleId}`);
console.log(`New episode ID : ${newEpisodeId}`);
```

**Rules:**
- Characters allowed: `a-z` and `0-9` only. No uppercase, no hyphens after the prefix, no spaces.
- Always verify the generated ID is not already in use before proceeding.
- The ID is permanent — it becomes part of the page URL and must never change after publishing.

---

## Step 4a — Build the new Article object

**Why:** This is the complete data record for one article. Every field must be present, even if empty.

**Where each field appears on the site:**

| Field | Home page | Articles list | Article detail page | Nav |
|---|---|---|---|---|
| `title` | ✅ headline | ✅ link text | ✅ heading | ✅ |
| `excerpt` | ✅ preview text | ✅ preview text | — | — |
| `body` | — | — | ✅ below chart | — |
| `chartData` | ✅ bar chart | — | ✅ bar chart | — |
| `keywords` | — | — | ✅ grey pills | — |
| `sources` | — | — | ✅ bottom | — |
| `categories` | — | ✅ tag links | ✅ tag links | — |

### Python
```python
def parse_duration(mmss: str) -> int:
    """Convert MM:SS string to integer seconds."""
    parts = mmss.strip().split(":")
    if len(parts) == 2:
        return int(parts[0]) * 60 + int(parts[1])
    return int(parts[0])

def build_article(article_id, title, excerpt, body,
                  category_ids, chart_values=None, chart_labels=None,
                  keywords="", sources=""):
    """
    article_id    : string — from Step 3
    title         : string — headline, will be uppercased on site
    excerpt       : string — 2-4 sentences, plain text
    body          : string — main text, use \\n\\n between paragraphs
    category_ids  : list   — IDs from data["categories"]
    chart_values  : list of numbers, or None to omit chart
    chart_labels  : list of strings matching chart_values length, or None
    keywords      : string — comma-separated, or ""
    sources       : string — semicolon-separated citations, or ""
    """
    # Validate chart data
    chart_data = None
    if chart_values:
        if not chart_labels or len(chart_values) != len(chart_labels):
            raise ValueError("chart_values and chart_labels must have equal length")
        if len(chart_values) > 6:
            raise ValueError("chartData supports a maximum of 6 bars")
        chart_data = {"values": list(chart_values), "labels": list(chart_labels)}

    return {
        "id":         article_id,
        "title":      title.upper(),
        "categories": category_ids,
        "excerpt":    excerpt.strip(),
        "body":       body.strip(),
        "chartData":  chart_data,
        "keywords":   keywords.strip(),
        "sources":    sources.strip()
    }

# Example usage
new_article = build_article(
    article_id   = new_article_id,
    title        = "EU Summit Reaches Landmark Trade Deal",
    excerpt      = "European leaders agreed on a comprehensive trade framework at this week's Brussels summit, marking the most significant economic accord in a decade.",
    body         = "The agreement, signed by all 27 member states, covers tariff reductions across agriculture, manufacturing, and digital services.\n\nImplementation is expected to begin in Q1 2025, pending ratification by national parliaments.",
    category_ids = selected_ids,
    chart_values = [72, 54, 61, 89, 45],
    chart_labels = ["Germany", "France", "Italy", "Poland", "Spain"],
    keywords     = "trade, summit, EU, economy",
    sources      = "European Council Press Release, March 2025; Financial Times, 10 March 2025"
)

print(json.dumps(new_article, indent=2))
```

### JavaScript (Node.js)
```javascript
function buildArticle({ articleId, title, excerpt, body,
                         categoryIds, chartValues, chartLabels,
                         keywords = "", sources = "" }) {
  // Validate chart data
  let chartData = null;
  if (chartValues) {
    if (!chartLabels || chartValues.length !== chartLabels.length)
      throw new Error("chartValues and chartLabels must have equal length");
    if (chartValues.length > 6)
      throw new Error("chartData supports a maximum of 6 bars");
    chartData = { values: chartValues, labels: chartLabels };
  }

  return {
    id:         articleId,
    title:      title.toUpperCase(),
    categories: categoryIds,
    excerpt:    excerpt.trim(),
    body:       body.trim(),
    chartData,
    keywords:   keywords.trim(),
    sources:    sources.trim()
  };
}

// Example usage
const newArticle = buildArticle({
  articleId:   newArticleId,
  title:       "EU Summit Reaches Landmark Trade Deal",
  excerpt:     "European leaders agreed on a comprehensive trade framework at this week's Brussels summit, marking the most significant economic accord in a decade.",
  body:        "The agreement, signed by all 27 member states, covers tariff reductions across agriculture, manufacturing, and digital services.\n\nImplementation is expected to begin in Q1 2025, pending ratification by national parliaments.",
  categoryIds: selectedIds,
  chartValues: [72, 54, 61, 89, 45],
  chartLabels: ["Germany", "France", "Italy", "Poland", "Spain"],
  keywords:    "trade, summit, EU, economy",
  sources:     "European Council Press Release, March 2025; Financial Times, 10 March 2025"
});

console.log(JSON.stringify(newArticle, null, 2));
```

### Article field rules

| Field | Type | Required | Rules |
|---|---|---|---|
| `id` | string | ✅ | From Step 3. Never change after publishing. |
| `title` | string | ✅ | Written in uppercase on the site automatically. 5–10 words recommended. |
| `categories` | array | ✅ | IDs only from `data.categories`. Use `[]` if none apply. |
| `excerpt` | string | ✅ | 2–4 sentences. Plain text. No HTML, no markdown. Shown on home page and list. |
| `body` | string | ✅ | One or more paragraphs. Plain text. Separate paragraphs with `\n\n`. No HTML. Shown below the chart on the detail page. |
| `chartData` | object \| null | ✅ | `null` = no chart. If present: `values` and `labels` arrays must have equal length (max 6 entries). `values` are plain numbers. `labels` are short strings (1 word each). |
| `keywords` | string | ✅ | Comma-separated. Shown as grey pills. `""` if none. |
| `sources` | string | ✅ | Semicolon-separated citations. `""` if none. |

---

## Step 4b — Build the new Episode object

**Why:** This is the complete data record for one podcast episode. Every field must be present, even if empty.

**Where each field appears on the site:**

| Field | Home page | Episodes list | Episode detail page | Nav |
|---|---|---|---|---|
| `title` | ✅ headline | ✅ link text | ✅ heading | ✅ |
| `season` + `episodeNumber` | — | ✅ badge | ✅ badge | — |
| `notes` | — | ✅ first 120 chars | ✅ full text | — |
| `audioUrl` | ✅ player | — | ✅ player | — |
| `coverArt` | — | — | ✅ hero image | — |
| `keywords` | — | — | ✅ grey pills | — |
| `categories` | — | ✅ tag links | ✅ tag links | — |

### Python
```python
def parse_mmss(mmss: str) -> int:
    """Convert MM:SS or H:MM:SS string to integer seconds."""
    parts = [int(p) for p in mmss.strip().split(":")]
    if len(parts) == 3:
        return parts[0] * 3600 + parts[1] * 60 + parts[2]
    if len(parts) == 2:
        return parts[0] * 60 + parts[1]
    return parts[0]

def next_episode_number(data, season):
    """Find the highest episodeNumber in a given season and return +1."""
    season_eps = [e["episodeNumber"] for e in data["episodes"] if e.get("season") == season]
    return max(season_eps, default=0) + 1

def build_episode(episode_id, title, duration_mmss, audio_url,
                  cover_art, season, episode_number,
                  category_ids, keywords="", notes="", pub_date=""):
    """
    episode_id     : string — from Step 3
    title          : string — sentence case
    duration_mmss  : string — "MM:SS" or "H:MM:SS"
    audio_url      : string — direct HTTPS URL to MP3 hosted on Cloudflare R2, or ""
    cover_art      : string — public HTTPS URL to image, or ""
    season         : int    — season number ≥ 1
    episode_number : int    — episode number within season ≥ 1
    category_ids   : list   — IDs from data["categories"]
    keywords       : string — comma-separated, or ""
    notes          : string — show notes, plain text, \\n\\n between paragraphs
    pub_date       : string — ISO date "YYYY-MM-DD" (e.g. "2026-03-12"), used in RSS feed pubDate
    """
    if cover_art.startswith("data:"):
        raise ValueError("coverArt must be a public HTTPS URL, never a base64 data URL")

    return {
        "id":            episode_id,
        "title":         title.strip(),
        "categories":    category_ids,
        "duration":      parse_mmss(duration_mmss),
        "audioUrl":      audio_url.strip(),
        "coverArt":      cover_art.strip(),
        "season":        int(season),
        "episodeNumber": int(episode_number),
        "keywords":      keywords.strip(),
        "notes":         notes.strip(),
        "pubDate":       pub_date.strip()
    }

# Example usage
season = 1
new_episode = build_episode(
    episode_id     = new_episode_id,
    title          = "The Trade Deal Explained",
    duration_mmss  = "28:00",
    audio_url      = "https://audio.europe-weekly.eu/europe-weekly-s1e6-trade-deal.mp3",
    cover_art      = "https://audio.europe-weekly.eu/covers/s1e6.jpg",
    season         = season,
    episode_number = next_episode_number(data, season),
    category_ids   = selected_ids,
    keywords       = "trade, EU, economy, summit",
    notes          = "This week we break down the EU trade deal agreed at the Brussels summit.\n\nWhat does it mean for businesses, consumers, and member states?",
    pub_date       = "2026-03-12"   # ISO date of publication
)

print(json.dumps(new_episode, indent=2))
```

### JavaScript (Node.js)
```javascript
function parseMmss(mmss) {
  const parts = mmss.trim().split(":").map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0];
}

function nextEpisodeNumber(data, season) {
  const nums = data.episodes
    .filter(e => e.season === season)
    .map(e => e.episodeNumber);
  return nums.length ? Math.max(...nums) + 1 : 1;
}

function buildEpisode({ episodeId, title, durationMmss, audioUrl,
                         coverArt, season, episodeNumber,
                         categoryIds, keywords = "", notes = "", pubDate = "" }) {
  if (coverArt.startsWith("data:"))
    throw new Error("coverArt must be a public HTTPS URL, never a base64 data URL");

  return {
    id:            episodeId,
    title:         title.trim(),
    categories:    categoryIds,
    duration:      parseMmss(durationMmss),
    audioUrl:      audioUrl.trim(),     // Direct HTTPS URL to MP3 on Cloudflare R2
    coverArt:      coverArt.trim(),
    season:        Number(season),
    episodeNumber: Number(episodeNumber),
    keywords:      keywords.trim(),
    notes:         notes.trim(),
    pubDate:       pubDate.trim()       // ISO date "YYYY-MM-DD", used in RSS feed pubDate
  };
}

// Example usage
const season = 1;
const newEpisode = buildEpisode({
  episodeId:     newEpisodeId,
  title:         "The Trade Deal Explained",
  durationMmss:  "28:00",
  audioUrl:      "https://audio.europe-weekly.eu/europe-weekly-s1e6-trade-deal.mp3",
  coverArt:      "https://audio.europe-weekly.eu/covers/s1e6.jpg",
  season,
  episodeNumber: nextEpisodeNumber(data, season),
  categoryIds:   selectedIds,
  keywords:      "trade, EU, economy, summit",
  notes:         "This week we break down the EU trade deal agreed at the Brussels summit.\n\nWhat does it mean for businesses, consumers, and member states?",
  pubDate:       "2026-03-12"   // ISO date of publication
});

console.log(JSON.stringify(newEpisode, null, 2));
```

### Episode field rules

| Field | Type | Required | Rules |
|---|---|---|---|
| `id` | string | ✅ | From Step 3. Never change after publishing. |
| `title` | string | ✅ | Sentence case. |
| `categories` | array | ✅ | IDs only from `data.categories`. Use `[]` if none apply. |
| `duration` | number | ✅ | Integer seconds. `0` if unknown. Formula: `(H×3600) + (M×60) + S`. |
| `audioUrl` | string | ✅ | Direct HTTPS URL to the MP3 file. Must be publicly accessible. `""` if not yet available. |
| `coverArt` | string | ✅ | Public HTTPS URL to a JPG or PNG. **Never base64.** `""` if none. |
| `season` | number | ✅ | Integer ≥ 1. |
| `episodeNumber` | number | ✅ | Integer ≥ 1. Must be higher than the last episode in the same season. |
| `keywords` | string | ✅ | Comma-separated. `""` if none. |
| `notes` | string | ✅ | Plain text. `\n\n` between paragraphs. First 120 characters shown as teaser on list page. `""` if none. |
| `pubDate` | string | ✅ | ISO date `"YYYY-MM-DD"` (e.g. `"2026-03-12"`). Used as the `<pubDate>` tag in the RSS feed so podcast apps display the correct publication date and sort episodes correctly. Use the actual air date. `""` is accepted but will default to the current timestamp in the feed. |

### Duration conversion reference
| Input | Seconds | Calculation |
|---|---|---|
| `"05:00"` | 300 | 5×60 |
| `"10:30"` | 630 | 10×60 + 30 |
| `"24:00"` | 1440 | 24×60 |
| `"45:15"` | 2715 | 45×60 + 15 |
| `"1:02:00"` | 3720 | 1×3600 + 2×60 |

---

## Step 5 — Prepend the new object

**Why:** The home page always displays `articles[0]` and `episodes[0]`. The newest post must be at position 0 so it becomes the featured item. Appending to the end makes the post invisible on the home page.

### Python
```python
# For a new article
data["articles"].insert(0, new_article)

# For a new episode
data["episodes"].insert(0, new_episode)

# Confirm position
print(f"articles[0] = {data['articles'][0]['id']}  ← should be your new post")
print(f"episodes[0] = {data['episodes'][0]['id']}  ← should be your new post")
```

### JavaScript (Node.js)
```javascript
// For a new article
data.articles.unshift(newArticle);

// For a new episode
data.episodes.unshift(newEpisode);

// Confirm position
console.log(`articles[0] = ${data.articles[0].id}  ← should be your new post`);
console.log(`episodes[0] = ${data.episodes[0].id}  ← should be your new post`);
```

**Rules:**
- `insert(0, ...)` / `unshift()` only. Never `append()` / `push()`.
- If publishing both an article and an episode in one run, prepend both.
- After this step, `data.articles.length` should be one more than before Step 5.

---

## Step 6 — Update the version field

**Why:** Every visitor's browser caches `content.json` locally. On each page load, the browser compares `data.version` from the server against its cached version. If the server value is higher, the cache is replaced. If you skip this step or use a lower number, visitors will see stale content.

**Rule:** `version` must be a Unix timestamp in **milliseconds** (13 digits). It must be strictly greater than the current value in the file.

### Python
```python
import time

old_version = data["version"]
data["version"] = int(time.time() * 1000)

print(f"version updated: {old_version} → {data['version']}")
# Example output: version updated: 1741694400000 → 1741782543210
```

### JavaScript (Node.js)
```javascript
const oldVersion = data.version;
data.version = Date.now();

console.log(`version updated: ${oldVersion} → ${data.version}`);
// Example output: version updated: 1741694400000 → 1741782543210
```

**What a correct version looks like:**
```
✅  1741782543210   ← 13 digits, Unix ms timestamp
❌  1               ← too small, browsers will ignore the update
❌  1741782543      ← 10 digits = seconds not milliseconds
```

---

## Step 7 — Validate and write content.json

**Why:** An invalid JSON file will crash the entire website for all visitors. Validate before writing.

### Python — full validation + write
```python
import json, os

def validate(data, new_id):
    errors = []

    # Version check
    if not isinstance(data.get("version"), int) or data["version"] < 1_000_000_000_000:
        errors.append("version must be a 13-digit Unix ms timestamp")

    # New post at position 0
    all_ids = [a["id"] for a in data["articles"]] + [e["id"] for e in data["episodes"]]
    if new_id not in all_ids:
        errors.append(f"new ID {new_id} not found in data")
    if data["articles"] and data["articles"][0]["id"] != new_id:
        if data["episodes"] and data["episodes"][0]["id"] != new_id:
            errors.append("new post is not at position 0")

    # Category IDs
    valid_cat_ids = {c["id"] for c in data["categories"]}
    for a in data["articles"]:
        for cid in a.get("categories", []):
            if cid not in valid_cat_ids:
                errors.append(f"article {a['id']} has unknown category ID: {cid}")
    for e in data["episodes"]:
        for cid in e.get("categories", []):
            if cid not in valid_cat_ids:
                errors.append(f"episode {e['id']} has unknown category ID: {cid}")

    # chartData arrays equal length
    for a in data["articles"]:
        cd = a.get("chartData")
        if cd and len(cd.get("values", [])) != len(cd.get("labels", [])):
            errors.append(f"article {a['id']}: chartData values/labels length mismatch")

    return errors

# Validate
errors = validate(data, new_article_id)  # or new_episode_id
if errors:
    for e in errors:
        print(f"❌ VALIDATION ERROR: {e}")
    raise SystemExit("Aborting — fix errors before writing")

print("✅ Validation passed")

# Write
CONTENT_FILE = "/tmp/europe-weekly/content.json"
with open(CONTENT_FILE, "w", encoding="utf-8") as f:
    json.dump(data, f, indent=2, ensure_ascii=False)
    f.write("\n")  # trailing newline

# Verify written file is valid JSON
with open(CONTENT_FILE, "r", encoding="utf-8") as f:
    json.load(f)  # raises exception if invalid

print(f"✅ content.json written — {os.path.getsize(CONTENT_FILE)} bytes")
```

### JavaScript (Node.js)
```javascript
const fs = require("fs");

function validate(data, newId) {
  const errors = [];

  // Version check
  if (typeof data.version !== "number" || data.version < 1_000_000_000_000)
    errors.push("version must be a 13-digit Unix ms timestamp");

  // New post at position 0
  const allIds = [...data.articles.map(a => a.id), ...data.episodes.map(e => e.id)];
  if (!allIds.includes(newId))
    errors.push(`new ID ${newId} not found in data`);
  const atPos0 =
    (data.articles[0]?.id === newId) || (data.episodes[0]?.id === newId);
  if (!atPos0)
    errors.push("new post is not at position 0");

  // Category IDs
  const validCatIds = new Set(data.categories.map(c => c.id));
  for (const a of data.articles)
    for (const cid of a.categories || [])
      if (!validCatIds.has(cid)) errors.push(`article ${a.id}: unknown category ID ${cid}`);
  for (const e of data.episodes)
    for (const cid of e.categories || [])
      if (!validCatIds.has(cid)) errors.push(`episode ${e.id}: unknown category ID ${cid}`);

  // chartData arrays equal length
  for (const a of data.articles)
    if (a.chartData && a.chartData.values.length !== a.chartData.labels.length)
      errors.push(`article ${a.id}: chartData values/labels length mismatch`);

  return errors;
}

// Validate
const errors = validate(data, newArticleId); // or newEpisodeId
if (errors.length) {
  errors.forEach(e => console.error(`❌ VALIDATION ERROR: ${e}`));
  process.exit(1);
}
console.log("✅ Validation passed");

// Write
const CONTENT_FILE = "/tmp/europe-weekly/content.json";
fs.writeFileSync(CONTENT_FILE, JSON.stringify(data, null, 2) + "\n", "utf-8");

// Verify written file is valid JSON
JSON.parse(fs.readFileSync(CONTENT_FILE, "utf-8"));

console.log(`✅ content.json written — ${fs.statSync(CONTENT_FILE).size} bytes`);
```

---

## Step 8 — Commit to GitHub

**Why:** GitHub is the permanent source of truth. Every published state of `content.json` must be committed so that the file can be recovered if Cloudflare is redeployed and so future bot runs always start from the correct base.

**Rules:**
- When publishing an **article only**: stage `content.json` alone.
- When publishing an **episode** (or both): stage `content.json` **and** `podcast-feed.xml` together in the same commit. See Step 8b for how to regenerate `podcast-feed.xml` server-side before staging it.
- Never commit HTML, CSS, JS, images, or any other file.
- The commit must be pushed to `main` before deploying to Cloudflare.

### Bash
```bash
cd /tmp/europe-weekly

# Ensure remote includes the PAT (set once per environment)
git remote set-url origin https://ghp_YOURTOKEN@github.com/tim-muky/europe-weekly.git

# For an article: stage content.json only
git add content.json

# For an episode: stage content.json AND podcast-feed.xml
# git add content.json podcast-feed.xml

# Confirm what is staged
git status
# Article:  "Changes to be committed: modified: content.json"
# Episode:  "Changes to be committed: modified: content.json  modified: podcast-feed.xml"

# Commit
git commit -m "post: Add article – EU SUMMIT REACHES LANDMARK TRADE DEAL"
# or for an episode:
# git commit -m "post: Add episode S1E6 – The Trade Deal Explained"

# Push
git push origin main
# Expected last line: "main -> main"
```

### Python (subprocess)
```python
import subprocess, sys

REPO_DIR = "/tmp/europe-weekly"
GITHUB_TOKEN = "ghp_YOURTOKEN"
POST_TITLE = new_article["title"]   # or new_episode["title"]
IS_EPISODE = False                  # set True when publishing an episode

def run(cmd, cwd=REPO_DIR):
    result = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"❌ Command failed: {' '.join(cmd)}")
        print(result.stderr)
        sys.exit(1)
    return result.stdout.strip()

# Set remote with token
run(["git", "remote", "set-url", "origin",
     f"https://{GITHUB_TOKEN}@github.com/tim-muky/europe-weekly.git"])

# Stage content.json (always) + podcast-feed.xml (episode publishes only)
files_to_stage = ["content.json"]
if IS_EPISODE:
    files_to_stage.append("podcast-feed.xml")
run(["git", "add"] + files_to_stage)

# Verify staged files are exactly what we expect
status = run(["git", "status", "--porcelain"])
staged = [l for l in status.splitlines() if l.startswith(("M ", "A "))]
allowed = set(files_to_stage)
unexpected = [l for l in staged if not any(f in l for f in allowed)]
if unexpected:
    print(f"❌ Unexpected staged files: {unexpected}")
    sys.exit(1)

# Commit
commit_msg = f"post: Add article – {POST_TITLE}"
run(["git", "commit", "-m", commit_msg])
print(f"✅ Committed: {commit_msg}")

# Push
output = run(["git", "push", "origin", "main"])
print(f"✅ Pushed to GitHub: {output}")
```

### JavaScript (Node.js)
```javascript
const { execSync } = require("child_process");

const REPO_DIR = "/tmp/europe-weekly";
const GITHUB_TOKEN = "ghp_YOURTOKEN";
const POST_TITLE = newArticle.title; // or newEpisode.title

function run(cmd) {
  try {
    return execSync(cmd, { cwd: REPO_DIR, encoding: "utf-8" }).trim();
  } catch (err) {
    console.error(`❌ Command failed: ${cmd}\n${err.stderr}`);
    process.exit(1);
  }
}

// Set remote with token
run(`git remote set-url origin https://${GITHUB_TOKEN}@github.com/tim-muky/europe-weekly.git`);

// Stage only content.json
run("git add content.json");

// Commit
const commitMsg = `post: Add article – ${POST_TITLE}`;
run(`git commit -m "${commitMsg}"`);
console.log(`✅ Committed: ${commitMsg}`);

// Push
run("git push origin main");
console.log("✅ Pushed to GitHub");
```

### Commit message format
```
post: Add article – TITLE IN UPPERCASE
post: Add episode S1E6 – Episode Title in Sentence Case
```

---

## Step 9 — Cloudflare deployment (automatic via GitHub)

**How it works:** Cloudflare Pages is connected to the GitHub repository. The `git push` in Step 8 is enough — Cloudflare detects the new commit on `main` and deploys automatically within 1–2 minutes. The bot does not need to call any Cloudflare API or run wrangler.

**What to expect after the push:**
- Cloudflare starts a new build immediately.
- The deployment appears in: Cloudflare dashboard → Pages → europe-weekly → Deployments.
- The live site (`https://europe-weekly.eu`) updates once the deployment status shows **"Success"**.

### Python — poll GitHub to confirm the push landed
```python
import urllib.request, json, time

GITHUB_TOKEN = "ghp_YOURTOKEN"
REPO = "tim-muky/europe-weekly"

# Wait up to 2 minutes for the commit to appear on the default branch
url = f"https://api.github.com/repos/{REPO}/commits/main"
headers = {"Authorization": f"token {GITHUB_TOKEN}", "Accept": "application/vnd.github.v3+json"}

for attempt in range(12):  # 12 × 10s = 2 minutes
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req) as resp:
        commit = json.loads(resp.read())
    latest_msg = commit["commit"]["message"]
    if "post:" in latest_msg:
        print(f"✅ Commit visible on GitHub: {latest_msg[:80]}")
        print("Cloudflare will deploy automatically within ~60 seconds.")
        break
    print(f"  Waiting for commit to appear... ({attempt + 1}/12)")
    time.sleep(10)
```

### JavaScript (Node.js) — poll GitHub to confirm the push landed
```javascript
const https = require("https");

const GITHUB_TOKEN = "ghp_YOURTOKEN";
const REPO = "tim-muky/europe-weekly";

function githubGet(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "api.github.com",
      path,
      headers: {
        "Authorization": `token ${GITHUB_TOKEN}`,
        "User-Agent":    "clawbot",
        "Accept":        "application/vnd.github.v3+json"
      }
    };
    https.get(options, res => {
      let body = "";
      res.on("data", c => body += c);
      res.on("end", () => resolve(JSON.parse(body)));
    }).on("error", reject);
  });
}

async function waitForCommit(maxAttempts = 12) {
  for (let i = 0; i < maxAttempts; i++) {
    const commit = await githubGet(`/repos/${REPO}/commits/main`);
    const msg = commit.commit.message;
    if (msg.startsWith("post:")) {
      console.log(`✅ Commit visible on GitHub: ${msg.slice(0, 80)}`);
      console.log("Cloudflare will deploy automatically within ~60 seconds.");
      return;
    }
    console.log(`  Waiting for commit to appear... (${i + 1}/${maxAttempts})`);
    await new Promise(r => setTimeout(r, 10000));
  }
  throw new Error("Commit did not appear on GitHub within 2 minutes");
}

waitForCommit().catch(err => { console.error(err.message); process.exit(1); });
```

---

### Manual fallback — only if GitHub integration is broken

If Cloudflare shows "The repository cannot be accessed" and auto-deployment is not working, run wrangler directly from the repository root. This requires Node.js and npx.

```bash
# Bash — run from /tmp/europe-weekly
CLOUDFLARE_API_TOKEN=9FGsooPcN-9_6IywigC9gYR-Z_MJJcH8jL37Ea_2 \
CLOUDFLARE_ACCOUNT_ID=346420fbb345201f091a6daf86735346 \
npx wrangler pages deploy . --project-name=europe-weekly
```

```python
# Python fallback
import subprocess, sys, os

env = os.environ.copy()
env["CLOUDFLARE_API_TOKEN"]  = "9FGsooPcN-9_6IywigC9gYR-Z_MJJcH8jL37Ea_2"
env["CLOUDFLARE_ACCOUNT_ID"] = "346420fbb345201f091a6daf86735346"

result = subprocess.run(
    ["npx", "wrangler", "pages", "deploy", ".", "--project-name=europe-weekly"],
    cwd="/tmp/europe-weekly", env=env, capture_output=True, text=True
)
if result.returncode != 0:
    print(f"❌ Wrangler failed:\n{result.stderr}"); sys.exit(1)
print(result.stdout)
```

**Both `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` must be set.** Without the account ID, wrangler fails with error code 10000.

To permanently fix auto-deployment instead of using this fallback: delete and recreate the Pages project in the Cloudflare dashboard connected to `tim-muky/europe-weekly`, branch `main`, build command empty, build output empty. Re-attach custom domain `europe-weekly.eu` afterwards.

---

## Step 10 — Verify

**Why:** Confirm the deployed `content.json` on Cloudflare actually contains the new post at position 0 with the correct version number. Do not mark the run as successful until this check passes.

### Bash
```bash
curl -s "https://europe-weekly.pages.dev/content.json?v=$(date +%s)" \
| python3 -c "
import json, sys
data = json.load(sys.stdin)
print('version      :', data['version'])
print('article[0]   :', data['articles'][0]['id'], '–', data['articles'][0]['title'])
print('episode[0]   :', data['episodes'][0]['id'], '–', data['episodes'][0]['title'])
"
```

### Python
```python
import urllib.request, json, time

url = f"https://europe-weekly.pages.dev/content.json?v={int(time.time())}"
with urllib.request.urlopen(url) as resp:
    deployed = json.loads(resp.read())

checks = [
    ("version matches",      deployed["version"] == data["version"]),
    ("article[0] is new",    deployed["articles"][0]["id"] == new_article_id),
    ("episode[0] is new",    deployed["episodes"][0]["id"] == new_episode_id),
]

all_ok = True
for label, passed in checks:
    status = "✅" if passed else "❌"
    print(f"{status}  {label}")
    if not passed:
        all_ok = False

if not all_ok:
    raise SystemExit("Verification failed — check deployment logs")

print("\n✅ Post is live at https://europe-weekly.eu")
```

### JavaScript (Node.js)
```javascript
const https = require("https");

const url = `https://europe-weekly.pages.dev/content.json?v=${Date.now()}`;

https.get(url, res => {
  let body = "";
  res.on("data", chunk => body += chunk);
  res.on("end", () => {
    const deployed = JSON.parse(body);

    const checks = [
      ["version matches",    deployed.version === data.version],
      ["article[0] is new",  deployed.articles[0].id === newArticleId],
      ["episode[0] is new",  deployed.episodes[0].id === newEpisodeId],
    ];

    let allOk = true;
    for (const [label, passed] of checks) {
      console.log(`${passed ? "✅" : "❌"}  ${label}`);
      if (!passed) allOk = false;
    }

    if (!allOk) { console.error("Verification failed"); process.exit(1); }
    console.log("\n✅ Post is live at https://europe-weekly.eu");
  });
});
```

**Expected output:**
```
✅  version matches
✅  article[0] is new
✅  episode[0] is new

✅ Post is live at https://europe-weekly.eu
```

---

## Execution order summary

```
1.  Fetch content.json from GitHub          git pull → parse JSON
2.  Read categories                         build label→ID map
3.  Generate unique ID                      article-XXXXXXX / episode-XXXXXXX
4a. Build Article object                    all 8 fields required
4b. Build Episode object                    all 11 fields required (incl. pubDate, audioUrl)
    └─ audioUrl = Cloudflare R2 public URL  upload MP3 to R2 first — see Appendix A
5.  Prepend to array at position 0          insert(0,...) / unshift()
6.  Set data.version = Date.now()           13-digit Unix ms timestamp
7.  Validate + write content.json           check errors, then write + re-parse
8b. (Episode only) Regenerate podcast-feed.xml  see Appendix B for server-side generator
8.  git add + commit + push                 article: content.json only
                                            episode: content.json + podcast-feed.xml
9.  Cloudflare auto-deploys from GitHub     no bot action needed — push triggers deploy
    └─ fallback: npx wrangler pages deploy  only if GitHub integration is broken
10. Verify via HTTPS fetch                  confirm version + [0] IDs match
```

---

## Common errors and fixes

| Error | Cause | Fix |
|---|---|---|
| Cloudflare says "repository cannot be accessed" | GitHub App integration broken | Delete the Pages project and recreate it in the Cloudflare dashboard connected to `tim-muky/europe-weekly`, branch `main`, build command empty. Re-attach custom domain `europe-weekly.eu`. |
| Push succeeds but site does not update | GitHub integration broken — Cloudflare not receiving webhook | Use wrangler fallback in Step 9 until integration is fixed |
| `Authentication error [code: 10000]` (wrangler) | `CLOUDFLARE_ACCOUNT_ID` env var missing | Always pass both `CLOUDFLARE_*` vars together |
| `Resource not accessible by integration` (git push) | Fine-grained GitHub PAT missing `Contents: write` | Replace with a classic PAT with full `repo` scope |
| Post not on home page | New post appended with `push()` not prepended | Re-run from Step 5 using `insert(0,...)` / `unshift()` |
| Visitors still see old content | `version` not incremented | Set `version = Date.now()` in Step 6 and re-push |
| Site broken / blank page | Invalid JSON written to `content.json` | Run validation in Step 7 before writing; restore last good commit from GitHub |
| Cover image not loading | `coverArt` set to a base64 `data:` URL | Replace with a public `https://` URL |
| `chartData` missing from article | `chart_values` was falsy but field omitted | Always include `"chartData": null` even when no chart |
| Episode duration shows `00:00` | `duration` set to `0` or left as string | Convert MM:SS to integer seconds in Step 4b |
| Audio player silent / not loading | `audioUrl` is empty or not a public HTTPS URL | Upload MP3 to Cloudflare R2 first (Appendix A), then paste the public URL |
| R2 audio file returns 403 | Public Development URL not enabled on bucket | In Cloudflare R2 bucket → Settings → Public Development URL → Enable |
| Browser blocks audio from R2 | CORS policy missing or wrong origin | In R2 bucket → Settings → CORS Policy — verify `AllowedOrigins` includes `https://europe-weekly.eu` |
| podcast-feed.xml not updated after new episode | Forgot to regenerate and commit the XML file | Run Appendix B generator after Step 7, stage `podcast-feed.xml` alongside `content.json` in Step 8 |
| Podcast apps show wrong episode dates | `pubDate` is empty or missing | Set `pubDate` to the ISO air date `"YYYY-MM-DD"` in Step 4b |
| Apple Podcasts / Spotify not updating to new feed | RSS.com redirect not set up | Log into RSS.com → Settings → Redirect Feed → paste `https://europe-weekly.eu/podcast-feed.xml` |

---

## Appendix A — Audio Hosting: Cloudflare R2

All podcast audio files are hosted in a Cloudflare R2 bucket. The bucket is separate from the Cloudflare Pages deployment. This section documents the bucket configuration and the per-episode upload workflow.

### Bucket details

| Property | Value |
|---|---|
| Bucket name | `europe-weekly-audio` |
| Account ID | `346420fbb345201f091a6daf86735346` |
| Location | Eastern Europe (EEUR) |
| S3 API endpoint | `https://346420fbb345201f091a6daf86735346.r2.cloudflarestorage.com/europe-weekly-audio` |
| Public Development URL | `https://pub-d8a18f8b52924560b2674b95d11a7ae7.r2.dev` |
| Custom domain (preferred) | `https://audio.europe-weekly.eu` |

### Bucket settings that must be active

These were configured once and must remain active. If audio stops working, check these first.

| Setting | Location in Cloudflare dashboard | Required value |
|---|---|---|
| Public access | R2 → europe-weekly-audio → Settings → Public Development URL | **Enabled** |
| Custom domain | R2 → europe-weekly-audio → Settings → Custom Domains | `audio.europe-weekly.eu` → Active |
| CORS policy | R2 → europe-weekly-audio → Settings → CORS Policy | See CORS block below |

**Required CORS policy (must be saved in bucket settings):**
```json
[
  {
    "AllowedOrigins": ["https://europe-weekly.eu"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 86400
  }
]
```

### File naming convention

Every audio file uploaded to R2 must follow this naming pattern — no spaces, no special characters, lowercase only:

```
europe-weekly-s{SEASON}e{EPISODE}-{short-slug}.mp3
```

Examples:
```
europe-weekly-s2e24-france-nuclear-update.mp3
europe-weekly-s2e25-poland-elections.mp3
europe-weekly-podcast-cover.jpg          ← show cover art (1400×1400 px minimum)
```

### Per-episode upload steps (manual, via Cloudflare dashboard)

These steps are performed by a human before the bot runs, because the bot does not have R2 write access by default.

1. Record and export the episode as an MP3
2. Rename the file following the naming convention above (no spaces)
3. Log into [dash.cloudflare.com](https://dash.cloudflare.com)
4. Navigate to **R2 Object Storage → europe-weekly-audio → Objects**
5. Click **"Upload"** → drag the MP3 file into the upload area → click **"Upload"**
6. Wait for the upload to complete (a 30-minute episode at 128 kbps ≈ 27 MB)
7. Click on the filename in the object list to open its details
8. Copy the **"Object URL"** — it will look like:
   ```
   https://audio.europe-weekly.eu/europe-weekly-s2e24-france-nuclear-update.mp3
   ```
9. Pass this URL to the bot as the `audio_url` / `audioUrl` parameter in Step 4b

### Per-episode upload steps (automated, via R2 S3-compatible API)

The bot can upload files programmatically using the S3-compatible API. This requires an R2 API token with **Object Read & Write** permissions.

**Generate an R2 API token:**
1. Cloudflare dashboard → R2 → Manage R2 API Tokens → Create API Token
2. Permissions: **Object Read & Write**
3. Scope: Specific bucket → `europe-weekly-audio`
4. Save the **Access Key ID** and **Secret Access Key** — they are shown only once

**Python upload using boto3:**
```python
import boto3, os

R2_ACCOUNT_ID    = "346420fbb345201f091a6daf86735346"
R2_ACCESS_KEY    = "YOUR_R2_ACCESS_KEY_ID"
R2_SECRET_KEY    = "YOUR_R2_SECRET_ACCESS_KEY"
R2_BUCKET        = "europe-weekly-audio"
R2_ENDPOINT      = f"https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
CUSTOM_DOMAIN    = "https://audio.europe-weekly.eu"

def upload_audio(local_path: str) -> str:
    """
    Upload an MP3 file to R2 and return its public URL.
    local_path: absolute path to the MP3, e.g. "/tmp/europe-weekly-s2e24-france.mp3"
    Returns: "https://audio.europe-weekly.eu/europe-weekly-s2e24-france.mp3"
    """
    filename = os.path.basename(local_path)

    # Validate filename — no spaces, no uppercase
    if " " in filename:
        raise ValueError(f"Filename must not contain spaces: {filename}")
    if filename != filename.lower():
        raise ValueError(f"Filename must be lowercase: {filename}")
    if not filename.endswith(".mp3"):
        raise ValueError(f"File must be an MP3: {filename}")

    s3 = boto3.client(
        "s3",
        endpoint_url         = R2_ENDPOINT,
        aws_access_key_id    = R2_ACCESS_KEY,
        aws_secret_access_key= R2_SECRET_KEY,
        region_name          = "auto"
    )

    print(f"Uploading {filename} to R2...")
    s3.upload_file(
        local_path,
        R2_BUCKET,
        filename,
        ExtraArgs={"ContentType": "audio/mpeg"}
    )

    public_url = f"{CUSTOM_DOMAIN}/{filename}"
    print(f"✅ Uploaded: {public_url}")
    return public_url

# Usage
audio_url = upload_audio("/tmp/europe-weekly-s2e24-france-nuclear-update.mp3")
# Pass audio_url as the audio_url parameter in build_episode()
```

**JavaScript (Node.js) upload using @aws-sdk/client-s3:**
```javascript
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const fs   = require("fs");
const path = require("path");

const R2_ACCOUNT_ID = "346420fbb345201f091a6daf86735346";
const R2_ACCESS_KEY = "YOUR_R2_ACCESS_KEY_ID";
const R2_SECRET_KEY = "YOUR_R2_SECRET_ACCESS_KEY";
const R2_BUCKET     = "europe-weekly-audio";
const CUSTOM_DOMAIN = "https://audio.europe-weekly.eu";

const s3 = new S3Client({
  endpoint:    `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  region:      "auto",
  credentials: { accessKeyId: R2_ACCESS_KEY, secretAccessKey: R2_SECRET_KEY }
});

async function uploadAudio(localPath) {
  const filename = path.basename(localPath);

  if (filename.includes(" ")) throw new Error(`Filename must not contain spaces: ${filename}`);
  if (filename !== filename.toLowerCase()) throw new Error(`Filename must be lowercase: ${filename}`);
  if (!filename.endsWith(".mp3")) throw new Error(`File must be an MP3: ${filename}`);

  const body = fs.readFileSync(localPath);

  console.log(`Uploading ${filename} to R2...`);
  await s3.send(new PutObjectCommand({
    Bucket:      R2_BUCKET,
    Key:         filename,
    Body:        body,
    ContentType: "audio/mpeg"
  }));

  const publicUrl = `${CUSTOM_DOMAIN}/${filename}`;
  console.log(`✅ Uploaded: ${publicUrl}`);
  return publicUrl;
}

// Usage (async context required)
const audioUrl = await uploadAudio("/tmp/europe-weekly-s2e24-france-nuclear-update.mp3");
// Pass audioUrl as the audioUrl parameter in buildEpisode()
```

**Install dependencies:**
```bash
# Python
pip install boto3

# Node.js
npm install @aws-sdk/client-s3
```

### Free tier limits

| Resource | Free allowance | Typical usage |
|---|---|---|
| Storage | 10 GB | ≈ 370 × 30-min episodes at 128 kbps |
| Egress bandwidth | **Free** (Cloudflare CDN — no egress fees) | Unlimited |
| Class A operations (writes) | 1 million / month | One upload per episode |
| Class B operations (reads) | 10 million / month | Listener downloads |

You will not be charged unless you store more than 10 GB of audio files.

---

## Appendix B — Podcast RSS Feed: Server-Side Generator

The file `podcast-feed.xml` lives in the repository root and is served at `https://europe-weekly.eu/podcast-feed.xml`. It must be regenerated every time a new episode is published and committed to the repo alongside `content.json`.

The browser-side generator lives in `script.js` (`generateRSSFeed()`). The functions below are the exact server-side equivalents for use in automated publishing scripts.

### What the RSS feed contains

- **Channel metadata**: title, description, cover art, author, email, iTunes category, language — read from `data.settings.podcast`
- **One `<item>` per episode**: title, description (from `notes`), audio enclosure URL, GUID, pubDate, duration, season, episode number
- **Self-referencing `<atom:link>`**: tells podcast apps the canonical feed URL is `https://europe-weekly.eu/podcast-feed.xml`

### Python generator
```python
from datetime import datetime, timezone

def generate_rss_feed(data, site_url="https://europe-weekly.eu"):
    """
    Generate podcast RSS 2.0 / iTunes XML from content.json data.
    Returns the XML string. Write it to podcast-feed.xml in the repo root.
    """
    def esc_xml(s):
        return str(s or "").replace("&","&amp;").replace("<","&lt;") \
                           .replace(">","&gt;").replace('"',"&quot;")

    def fmt_dur(sec):
        sec = int(sec or 0)
        h, rem = divmod(sec, 3600)
        m, s   = divmod(rem, 60)
        return f"{h}:{m:02d}:{s:02d}" if h > 0 else f"{m:02d}:{s:02d}"

    def to_rfc2822(date_str):
        if date_str:
            try:
                d = datetime.fromisoformat(str(date_str))
                if d.tzinfo is None:
                    d = d.replace(tzinfo=timezone.utc)
                return d.strftime("%a, %d %b %Y %H:%M:%S +0000")
            except Exception:
                pass
        return datetime.now(timezone.utc).strftime("%a, %d %b %Y %H:%M:%S +0000")

    pod      = (data.get("settings") or {}).get("podcast") or {}
    title    = esc_xml(pod.get("title")       or "Europe Weekly")
    desc     = esc_xml(pod.get("description") or "")
    author   = esc_xml(pod.get("author")      or "Europe Weekly")
    email    = esc_xml(pod.get("email")       or "")
    cover    = esc_xml(pod.get("coverArt")    or "")
    category = esc_xml(pod.get("category")    or "News")
    lang     = esc_xml(pod.get("language")    or "en")
    year     = datetime.now().year
    cover_tag = f'\n    <itunes:image href="{cover}"/>' if cover else ""

    items = []
    for ep in data.get("episodes", []):
        desc_ep = esc_xml(ep.get("notes") or ep.get("description") or "")
        enc = (f'\n      <enclosure url="{esc_xml(ep["audioUrl"])}" '
               f'length="0" type="audio/mpeg"/>') if ep.get("audioUrl") else ""
        items.append(f"""    <item>
      <title>{esc_xml(ep.get("title",""))}</title>
      <description>{desc_ep}</description>{enc}
      <guid isPermaLink="false">{esc_xml(ep.get("id",""))}</guid>
      <pubDate>{to_rfc2822(ep.get("pubDate",""))}</pubDate>
      <link>{site_url}/episode.html?id={ep.get("id","")}</link>
      <itunes:duration>{fmt_dur(ep.get("duration",0))}</itunes:duration>
      <itunes:season>{ep.get("season",1)}</itunes:season>
      <itunes:episode>{ep.get("episodeNumber",1)}</itunes:episode>
      <itunes:explicit>false</itunes:explicit>
    </item>""")

    return f"""<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
     xmlns:itunes="http://www.itunes.com/dtds/podcast-1_0.dtd"
     xmlns:atom="http://www.w3.org/2005/Atom"
     xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>{title}</title>
    <link>{site_url}</link>
    <description>{desc}</description>
    <language>{lang}</language>
    <copyright>© {year} {author}</copyright>
    <atom:link href="{site_url}/podcast-feed.xml" rel="self" type="application/rss+xml"/>
    <itunes:author>{author}</itunes:author>
    <itunes:owner>
      <itunes:name>{author}</itunes:name>
      <itunes:email>{email}</itunes:email>
    </itunes:owner>{cover_tag}
    <itunes:category text="{category}"/>
    <itunes:explicit>false</itunes:explicit>
{"".join(items)}
  </channel>
</rss>"""


# ── Usage (call this AFTER Steps 5–7, before Step 8 git commit) ────────────
import os

REPO_DIR     = "/tmp/europe-weekly"
RSS_FILE     = os.path.join(REPO_DIR, "podcast-feed.xml")

xml = generate_rss_feed(data)

with open(RSS_FILE, "w", encoding="utf-8") as f:
    f.write(xml)

print(f"✅ podcast-feed.xml written — {os.path.getsize(RSS_FILE)} bytes")

# Then in Step 8, stage it alongside content.json:
#   run(["git", "add", "content.json", "podcast-feed.xml"])
```

### JavaScript (Node.js) generator
```javascript
const fs   = require("fs");
const path = require("path");

function generateRSSFeed(data, siteUrl = "https://europe-weekly.eu") {
  const pod = (data.settings || {}).podcast || {};

  function escXml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function fmtDur(sec) {
    sec = Math.floor(sec || 0);
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return h > 0
      ? `${h}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`
      : `${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
  }
  function toRFC2822(dateStr) {
    const d = dateStr ? new Date(dateStr) : null;
    return (d && !isNaN(d)) ? d.toUTCString() : new Date().toUTCString();
  }

  const items = data.episodes.map(ep => {
    const desc = escXml(ep.notes || ep.description || "");
    const enc  = ep.audioUrl
      ? `\n      <enclosure url="${escXml(ep.audioUrl)}" length="0" type="audio/mpeg"/>`
      : "";
    return `    <item>
      <title>${escXml(ep.title)}</title>
      <description>${desc}</description>${enc}
      <guid isPermaLink="false">${escXml(ep.id)}</guid>
      <pubDate>${toRFC2822(ep.pubDate)}</pubDate>
      <link>${siteUrl}/episode.html?id=${encodeURIComponent(ep.id)}</link>
      <itunes:duration>${fmtDur(ep.duration)}</itunes:duration>
      <itunes:season>${ep.season || 1}</itunes:season>
      <itunes:episode>${ep.episodeNumber || 1}</itunes:episode>
      <itunes:explicit>false</itunes:explicit>
    </item>`;
  }).join("\n");

  const title    = escXml(pod.title       || "Europe Weekly");
  const desc     = escXml(pod.description || "");
  const author   = escXml(pod.author      || "Europe Weekly");
  const email    = escXml(pod.email       || "");
  const cover    = escXml(pod.coverArt    || "");
  const category = escXml(pod.category    || "News");
  const lang     = escXml(pod.language    || "en");
  const year     = new Date().getFullYear();

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
     xmlns:itunes="http://www.itunes.com/dtds/podcast-1_0.dtd"
     xmlns:atom="http://www.w3.org/2005/Atom"
     xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>${title}</title>
    <link>${siteUrl}</link>
    <description>${desc}</description>
    <language>${lang}</language>
    <copyright>© ${year} ${author}</copyright>
    <atom:link href="${siteUrl}/podcast-feed.xml" rel="self" type="application/rss+xml"/>
    <itunes:author>${author}</itunes:author>
    <itunes:owner>
      <itunes:name>${author}</itunes:name>
      <itunes:email>${email}</itunes:email>
    </itunes:owner>${cover ? `\n    <itunes:image href="${cover}"/>` : ""}
    <itunes:category text="${category}"/>
    <itunes:explicit>false</itunes:explicit>
${items}
  </channel>
</rss>`;
}

// ── Usage (call this AFTER Steps 5–7, before Step 8 git commit) ────────────
const REPO_DIR = "/tmp/europe-weekly";
const RSS_FILE = path.join(REPO_DIR, "podcast-feed.xml");

const xml = generateRSSFeed(data);
fs.writeFileSync(RSS_FILE, xml, "utf-8");

console.log(`✅ podcast-feed.xml written — ${fs.statSync(RSS_FILE).size} bytes`);

// Then in Step 8, stage it alongside content.json:
//   run(`git add content.json podcast-feed.xml`);
```

### Podcast settings in content.json

The RSS feed reads its channel-level metadata from `data.settings.podcast`. This object must exist with all seven fields. If a field is missing the generator falls back to safe defaults.

| Field | Path in content.json | RSS tag it populates | Example value |
|---|---|---|---|
| `title` | `settings.podcast.title` | `<title>` | `"Europe Weekly"` |
| `description` | `settings.podcast.description` | `<description>` and `<itunes:summary>` | `"Independent media covering..."` |
| `coverArt` | `settings.podcast.coverArt` | `<itunes:image href="..."/>` | `"https://audio.europe-weekly.eu/podcast-cover.jpg"` |
| `author` | `settings.podcast.author` | `<itunes:author>` and `<itunes:owner><itunes:name>` | `"Europe Weekly"` |
| `email` | `settings.podcast.email` | `<itunes:owner><itunes:email>` | `"contact@europe-weekly.eu"` |
| `category` | `settings.podcast.category` | `<itunes:category text="..."/>` | `"News"` |
| `language` | `settings.podcast.language` | `<language>` | `"en"` |

To update these settings: use the **admin CMS** (`admin.html` → Settings → Podcast Feed → Save Settings → Export content.json). The exported `content.json` will contain the updated `settings.podcast` object. The bot reads this automatically in Step 1.

### Podcast directory redirect (one-time setup)

When migrating from RSS.com to self-hosted:

1. **RSS.com**: Log in → podcast dashboard → Settings → **"Redirect Feed"** → enter `https://europe-weekly.eu/podcast-feed.xml` → Save. RSS.com will add `<itunes:new-feed-url>` to the old feed and return HTTP 301. All podcast apps that follow redirects will migrate subscribers automatically within 24–48 hours.

2. **Apple Podcasts Connect** ([podcastsconnect.apple.com](https://podcastsconnect.apple.com)): Select show → Settings → Feed URL → update to `https://europe-weekly.eu/podcast-feed.xml`.

3. **Spotify for Podcasters** ([podcasters.spotify.com](https://podcasters.spotify.com)): Settings → RSS Feed → update URL.

4. Keep the RSS.com account active for at least 3–6 months so the redirect covers lagging subscribers before cancelling.
