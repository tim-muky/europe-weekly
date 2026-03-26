# X (Twitter) Auto-Post — Setup Guide

New articles added in the CMS are automatically posted to X within
a few minutes of saving, with a 20-minute delay between each post.

---

## What you need

| Item | Notes |
|---|---|
| X account | `@europeweeklypod` — the account that will post |
| X Developer account | Free tier is enough (1 app, 1,500 tweets/month) |
| Anthropic API key | For Claude to generate tweet text |

---

## Step 1 — Apply for X Developer access

1. Go to [developer.x.com](https://developer.x.com)
2. Sign in with the `@europeweeklypod` account
3. Click **Sign up for Free Account** (or upgrade if you need more tweets)
4. Describe your use case: *"Automated news posts for our European politics podcast and news site"*
5. Accept the terms — approval is usually instant for the Free tier

---

## Step 2 — Create an X App

1. In the Developer Portal, go to **Projects & Apps**
2. Click **+ Add App** (under your default project)
3. Name it `Europe Weekly Bot`
4. You'll see your **API Key** and **API Key Secret** — **copy them now**
   (you cannot view them again)

| Value | Example |
|---|---|
| API Key | `xAi3b9...` |
| API Key Secret | `kP7mN2...` |

---

## Step 3 — Generate Access Tokens

1. In your app settings, go to the **Keys and tokens** tab
2. Under **Authentication Tokens**, click **Generate** next to
   *Access Token and Secret*
3. **Important**: Make sure the access token has **Read and Write** permissions.
   If it says "Read only", go to **App settings → User authentication settings →
   Edit** and set permissions to **Read and Write**, then regenerate the tokens.
4. Copy the **Access Token** and **Access Token Secret**

| Value | Example |
|---|---|
| Access Token | `19283746-aB3c...` |
| Access Token Secret | `x9Kp2m...` |

---

## Step 4 — Get an Anthropic API key

1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Sign in or create an account
3. Go to **API Keys** → **Create Key**
4. Name it `Europe Weekly X Bot`
5. Copy the key (starts with `sk-ant-...`)

> **Cost**: Each tweet generation uses Claude Haiku, costing roughly
> $0.001 per tweet. Even 100 tweets/month costs under $0.10.

---

## Step 5 — Add the five GitHub Secrets

Go to: **github.com/tim-muky/europe-weekly/settings/secrets/actions**

Click **New repository secret** for each:

| Secret name | Value |
|---|---|
| `X_API_KEY` | API Key from Step 2 |
| `X_API_SECRET` | API Key Secret from Step 2 |
| `X_ACCESS_TOKEN` | Access Token from Step 3 |
| `X_ACCESS_TOKEN_SECRET` | Access Token Secret from Step 3 |
| `ANTHROPIC_API_KEY` | API key from Step 4 |

---

## Done — how it works from now on

```
You save article(s) in CMS
        ↓
CMS pushes content.json to GitHub
        ↓
GitHub Actions detects new article(s)
        ↓
Claude generates tweet text + hashtags
(1-2 sentences + article link + episode link + hashtags)
        ↓
Posts to @europeweeklypod on X
        ↓
20-minute delay between each article post
```

---

## Tweet format per article

Each tweet includes:
- **1-2 sentences** summarising the article (AI-generated)
- **Article link**: `https://europe-weekly.eu/article.html?id={articleId}`
- **Episode link** (if a podcast episode was published the same day)
- **3-5 hashtags** including `#EuropeWeekly`

Example:
```
Greece declines a U.S. request to host naval facilities,
reinforcing its policy of balanced NATO engagement while
maintaining ties with Turkey and Russia.

https://europe-weekly.eu/article.html?id=article-3rk1z98
🎧 https://europe-weekly.eu/episode.html?id=episode-aw17m3h

#EuropeWeekly #Greece #NATO #ForeignPolicy
```

---

## Troubleshooting

**Action runs but no tweet appears**
Check the Actions log at `github.com/tim-muky/europe-weekly/actions`.
Common causes: wrong secret values, app permissions set to "Read only".

**`403 Forbidden` error**
Your app needs **Read and Write** permissions. Go to Developer Portal →
Your App → Settings → User authentication settings → set to Read and Write.
Then regenerate your Access Token and Secret (Step 3) and update the
GitHub Secrets.

**Rate limits**
The Free tier allows 1,500 tweets/month. With ~4 articles/day that's ~120
tweets/month — well within limits.

**Tweets are too long**
The Claude prompt enforces the 280-character limit. If a tweet occasionally
exceeds it, check the Actions log — the X API will reject it with a clear
error. The prompt can be tuned in `scripts/x_post.py`.

**`401 Unauthorized` from Anthropic**
The `ANTHROPIC_API_KEY` secret may be wrong or expired. Generate a new one
at [console.anthropic.com](https://console.anthropic.com) and update the
GitHub Secret.
