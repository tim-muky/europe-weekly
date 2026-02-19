# Europe Weekly Website - Setup Summary

## What's Been Created

A simple Jekyll-based static website for Europe Weekly podcast.

### File Structure

```
Projects/RSS2/website/
├── _config.yml              # Site configuration
├── _layouts/
│   ├── default.html         # Main page layout
│   ├── article.html         # Article layout
│   ├── podcast.html         # Podcast episode layout
│   └── post.html            # Generic post layout
├── _posts/
│   ├── articles/            # Written articles
│   │   └── 2026-02-19-sample-article.md
│   └── podcasts/            # Podcast episodes
│       └── 2026-02-19-episode-16.md
├── _pages/
│   ├── about.md             # About page
│   └── imprint.md           # Legal imprint
├── assets/
│   ├── css/
│   │   └── style.css        # Simple responsive styles
│   └── images/              # Cover art, images
├── podcast/
│   └── index.html           # Podcast episode list
├── feed.xml                 # RSS feed (auto-generated)
├── index.html               # Homepage (articles list)
├── Gemfile                  # Jekyll dependencies
├── deploy.sh                # Deployment helper
└── README.md                # Documentation
```

## Pages Included

1. **Home** (/) - Articles listing
2. **Podcast** (/podcast/) - Episode archive with player
3. **About** (/about/) - About Europe Weekly
4. **Imprint** (/imprint/) - Legal information
5. **RSS Feed** (/feed.xml) - Podcast RSS for directories

## Features

### Articles
- Headline, text body, subheadlines
- Categories (countries)
- Tags (topics)
- Sources section
- Link to related podcast episode
- Embedded audio player

### Podcast Episodes
- Season/Episode numbering
- Audio player (streams from GCS)
- Download link
- Duration display
- Countries covered tags
- Episode notes
- Keywords

### RSS Feed
- iTunes-compatible
- Pulls audio from: `https://storage.googleapis.com/europe-weekly-podcast/episodes/`
- Auto-updates when new episodes are posted

## Deployment Steps

### Option 1: GitHub Pages (Free)

1. **Create GitHub Repository**
   ```bash
   cd ~/.openclaw/workspace/Projects/RSS2/website
   git init
   git add .
   git commit -m "Initial website"
   # Create repo on GitHub, then:
   git remote add origin https://github.com/YOURNAME/europe-weekly-website.git
   git push -u origin main
   ```

2. **Enable GitHub Pages**
   - Go to repo Settings → Pages
   - Source: Deploy from branch
   - Branch: main / root
   - Save

3. **Add Custom Domain**
   - In Settings → Pages, add: `europe-weekly.eu`
   - Check "Enforce HTTPS"

4. **Configure DNS**
   - At your domain registrar, add:
     - A records: 185.199.108.153, 185.199.109.153, 185.199.110.153, 185.199.111.153
     - OR CNAME: yourname.github.io
   - Add CNAME file to repo with: `europe-weekly.eu`

### Option 2: Manual Hosting

1. Build the site:
   ```bash
   cd ~/.openclaw/workspace/Projects/RSS2/website
   bundle install
   bundle exec jekyll build
   ```

2. Upload `_site/` folder contents to your web server

## Adding Content

### New Article

Create file: `_posts/articles/YYYY-MM-DD-title.md`

```yaml
---
layout: article
title: "Article Title"
date: 2026-02-20
categories: [Germany, Politics]
tags: [EU, Election]
podcast_episode: EW-Ep._2026_02_20_Final.mp3
---

Article content here...
```

### New Podcast Episode

Create file: `_posts/podcasts/YYYY-MM-DD-episode-XX.md`

```yaml
---
layout: podcast
title: "Europe Weekly S2E17"
date: 2026-02-20
season: 2
episode: 17
categories: [podcast]
countries: [Bulgaria, Slovenia, Romania, Croatia]
audio_file: EW-Ep._2026_02_20_Final.mp3
duration: "24:15"
file_size: 35000000
keywords: [Bulgaria, Slovenia, Romania, Croatia, EU]
---

Episode notes here...
```

## What's Missing (Phase 2)

- [ ] Actual cover art image (add to assets/images/)
- [ ] Domain DNS configuration
- [ ] Submit RSS to podcast directories (Apple, Spotify, etc.)
- [ ] CMS for easier content management
- [ ] Search functionality
- [ ] Newsletter signup
- [ ] Social media integration

## Current Status

✅ GCS bucket with episode uploaded  
✅ Website structure created  
✅ RSS feed configured  
⏳ Need: GitHub repo + DNS setup  
⏳ Need: Cover art image  

Ready to deploy! 🚀
