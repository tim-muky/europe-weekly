# YouTube Auto-Publish — Setup Guide

New episodes added in the CMS are automatically uploaded to YouTube within
a few minutes of saving. This is a one-time setup.

---

## What you need

| Item | Notes |
|---|---|
| Google account | Must be the owner of the YouTube channel |
| Python 3.8+ | Already on your Mac |
| Verified YouTube channel | Required to upload videos > 15 minutes |

### Verify your channel for long videos
1. Go to **YouTube Studio → Settings → Channel → Feature eligibility**
2. Under *Intermediate features*, click **Verify** and follow the SMS step
   (if it already says "Enabled" you're good)

---

## Step 1 — Create a Google Cloud project

1. Open [console.cloud.google.com](https://console.cloud.google.com)
2. Click the project dropdown (top bar) → **New Project**
3. Name it `europe-weekly-yt` → **Create**

---

## Step 2 — Enable the YouTube Data API

1. In your new project, go to **APIs & Services → Library**
2. Search for `YouTube Data API v3`
3. Click it → **Enable**

---

## Step 3 — Create OAuth 2.0 credentials

1. Go to **APIs & Services → Credentials**
2. Click **+ Create Credentials → OAuth client ID**
3. If asked to configure the consent screen first:
   - Click **Configure Consent Screen**
   - Choose **External** → **Create**
   - Fill in:
     - App name: `Europe Weekly CMS`
     - User support email: your email
     - Developer contact email: your email
   - Click **Save and Continue** through all steps
   - On the **Test users** step, add your Google account email → **Save**
   - Go back to **Credentials → + Create Credentials → OAuth client ID**
4. Application type: **Desktop app**
5. Name: `Europe Weekly uploader`
6. Click **Create**
7. Click **Download JSON** — save it somewhere safe (you won't need the file,
   just copy the values from it)

The downloaded JSON looks like this — note down the two values:
```json
{
  "installed": {
    "client_id": "123456789-abc.apps.googleusercontent.com",   ← copy this
    "client_secret": "GOCSPX-abc123xyz"                        ← copy this
  }
}
```

---

## Step 4 — Get your refresh token (one-time, on your Mac)

Open Terminal in the project folder and run:

```bash
python3 scripts/get_youtube_token.py
```

- Paste the **Client ID** and **Client Secret** when asked
- Your browser opens → sign in with the YouTube channel's Google account
- Grant access to *Manage your YouTube videos*
- Terminal prints three values — **copy them immediately**

---

## Step 5 — Add the three GitHub Secrets

Go to: **github.com/tim-muky/europe-weekly/settings/secrets/actions**

Click **New repository secret** for each:

| Secret name | Value |
|---|---|
| `YOUTUBE_CLIENT_ID` | Client ID from Step 3 |
| `YOUTUBE_CLIENT_SECRET` | Client Secret from Step 3 |
| `YOUTUBE_REFRESH_TOKEN` | Refresh token printed in Step 4 |

---

## Done — how it works from now on

```
You save episode in CMS
        ↓
CMS pushes content.json to GitHub
        ↓
GitHub Actions detects new episode(s)
        ↓
Downloads MP3 + cover art
        ↓
ffmpeg encodes 720p video
(blurred cover background + crisp cover centred)
        ↓
Uploads to YouTube with title, description, tags
        ↓
Video goes public within ~5 minutes of saving
```

---

## Video metadata per episode

| Field | Value |
|---|---|
| **Title** | `Europe Weekly S{season}E{ep} – {episode title}` |
| **Description** | Episode notes + link to episode page + social links + hashtags |
| **Tags** | Episode keywords + `Europe Weekly`, `European Politics`, `EU`, `Podcast`, … |
| **Category** | News & Politics |
| **Privacy** | Public (immediately) |
| **Language** | English |

---

## Troubleshooting

**Action runs but no video appears**
Check the Actions log at `github.com/tim-muky/europe-weekly/actions`.
Common causes: wrong secret values, channel not verified for long videos.

**`quotaExceeded` error**
The YouTube API has a daily quota of 10,000 units; one upload costs ~1,600.
You can upload ~6 videos per day before hitting the limit. If you publish more,
request a quota increase in Google Cloud Console → APIs & Services → Quotas.

**Refresh token stopped working**
Google invalidates refresh tokens if unused for 6 months, or if the OAuth app
is still in "Testing" mode (limit: 7 days). To fix:
- For 7-day limit: publish your OAuth app in Google Cloud Console →
  APIs & Services → OAuth consent screen → **Publish App**
- Then re-run `python3 scripts/get_youtube_token.py` and update the GitHub Secret
