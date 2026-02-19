# Europe Weekly Website

Simple Jekyll-based website for Europe Weekly podcast.

## Phase 1: Simple Static Site
- GitHub Pages hosting
- Markdown articles
- Auto-generated RSS
- Links to GCS audio files

## Structure

```
├── _config.yml          # Site configuration
├── _layouts/            # Page templates
│   ├── default.html     # Main layout
│   ├── article.html     # Article layout
│   └── podcast.html     # Podcast episode layout
├── _posts/              # Articles and episodes
│   ├── articles/        # Written articles
│   └── podcasts/        # Podcast episodes
├── _pages/              # Static pages
│   ├── about.md
│   └── imprint.md
├── assets/              # CSS, images
│   └── css/
├── podcast/             # Podcast index
├── feed.xml             # RSS feed
└── index.html           # Homepage
```

## Setup Instructions

1. Create GitHub repo: `europe-weekly-website`
2. Enable GitHub Pages in settings
3. Add custom domain: europe-weekly.eu
4. Configure DNS to point to GitHub Pages

## Adding Content

### New Article:
Create file in `_posts/articles/YYYY-MM-DD-title.md`:
```yaml
---
layout: article
title: "Article Title"
date: 2026-02-19
categories: [Germany, Politics]
tags: [EU, Election]
podcast_episode: EW-Ep._2026_02_19_Final.mp3
---

Article content here...
```

### New Podcast Episode:
Create file in `_posts/podcasts/YYYY-MM-DD-episode-XX.md`:
```yaml
---
layout: podcast
title: "Europe Weekly S2E16"
date: 2026-02-19
season: 2
episode: 16
countries: [Portugal, Spain, Italy, Greece]
audio_file: EW-Ep._2026_02_19_Final.mp3
duration: "23:34"
file_size: 33940001
---

Episode notes here...
```

## Local Development

```bash
cd website
bundle install
bundle exec jekyll serve
```

Visit: http://localhost:4000
