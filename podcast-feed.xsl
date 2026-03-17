<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:itunes="http://www.itunes.com/dtds/podcast-1_0.dtd"
  xmlns:atom="http://www.w3.org/2005/Atom"
  exclude-result-prefixes="itunes atom">

  <xsl:output method="html" version="5.0" encoding="UTF-8" indent="yes"/>

  <xsl:template match="/">
    <html lang="en">
      <head>
        <meta charset="UTF-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
        <title><xsl:value-of select="/rss/channel/title"/> – Podcast Feed</title>
        <style>
          *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

          body {
            font-family: Arial, Helvetica, sans-serif;
            font-size: 15px;
            line-height: 1.55;
            color: #111;
            background: #fff;
          }

          /* ── HEADER — matches .article-header ── */
          .site-header {
            background: #F1F1EC;
            padding: 20px 36px 0;
            border-bottom: 1.5px solid #ccc;
          }
          .site-nav {
            display: flex;
            flex-direction: column;
            gap: 4px;
            margin-bottom: 16px;
          }
          .nav-main {
            font-size: 1.15rem;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: 0.02em;
            text-decoration: none;
            color: #1c3252;
          }
          .nav-sub {
            font-size: 0.82rem;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.03em;
            text-decoration: none;
            color: #1c3252;
            opacity: 0.55;
          }
          .nav-sub:hover, .nav-main:hover { text-decoration: underline; }

          /* ── MAIN — matches article-page main ── */
          main {
            background: #c5daea;
            min-height: calc(100vh - 130px);
            padding: 28px 36px 48px;
          }

          /* ── INTRO BLOCK ── */
          .feed-heading {
            font-size: 1rem;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: 0.03em;
            color: #1c3252;
            margin-bottom: 18px;
          }
          .feed-desc {
            font-size: 0.88rem;
            line-height: 1.6;
            color: #333;
            margin-bottom: 18px;
            max-width: 620px;
          }
          .rss-pill-row {
            display: flex;
            align-items: center;
            gap: 12px;
            flex-wrap: wrap;
            margin-bottom: 32px;
          }
          .rss-pill {
            display: inline-block;
            background: #f5f064;
            color: #111;
            font-size: 0.72rem;
            font-weight: 700;
            padding: 4px 14px;
            border-radius: 20px;
            white-space: nowrap;
            text-decoration: none;
          }
          .rss-url {
            font-size: 0.78rem;
            color: #1a6ba8;
            word-break: break-all;
            text-decoration: none;
          }
          .rss-url:hover { text-decoration: underline; }

          /* ── SECTION LABEL ── */
          .section-label {
            font-size: 0.78rem;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            color: #4a6a8a;
            margin-bottom: 14px;
            padding-bottom: 6px;
            border-bottom: 1px solid #aac4d8;
          }

          /* ── EPISODE CARDS — matches .ep-list-card ── */
          .ep-card {
            display: block;
            background: #16487D;
            color: #fff;
            border-radius: 4px;
            padding: 18px 22px;
            margin-bottom: 14px;
            text-decoration: none;
            transition: background 0.15s;
          }
          .ep-card:hover { background: #1c5a99; }

          .ep-badge {
            display: block;
            font-size: 0.7rem;
            font-weight: 700;
            letter-spacing: 0.06em;
            color: #8ab4cc;
            text-transform: uppercase;
            margin-bottom: 5px;
          }
          .ep-title {
            font-size: 0.88rem;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: 0.03em;
            margin-bottom: 8px;
          }
          .ep-desc {
            font-size: 0.8rem;
            color: #8ab0c8;
            line-height: 1.55;
            margin-bottom: 10px;
          }
          .ep-meta {
            font-size: 0.72rem;
            color: #6a90b0;
            display: flex;
            gap: 16px;
            flex-wrap: wrap;
            padding-top: 10px;
            border-top: 1px solid rgba(255,255,255,0.1);
          }

          /* ── FOOTER — matches .site-footer ── */
          .site-footer {
            background: #1c3252;
            color: rgba(255,255,255,0.7);
            text-align: center;
            padding: 18px;
            font-size: 0.82rem;
          }
          .site-footer a { color: rgba(255,255,255,0.9); text-decoration: none; }
          .site-footer a:hover { text-decoration: underline; }

          @media (max-width: 600px) {
            main { padding: 20px 18px 40px; }
            .site-header { padding: 16px 18px 0; }
          }

          @media (prefers-color-scheme: dark) {
            body { background: #0d1520; color: #e0e8f0; }
            .site-header { background: #121820; border-bottom-color: #2a4a6b; }
            .nav-main, .nav-sub { color: #6ab0e0; }
            main { background: #121820; }
            .feed-heading { color: #6ab0e0; }
            .feed-desc { color: #a0aab4; }
            .section-label { color: #4a7a9a; border-bottom-color: #2a4a6b; }
            .rss-url { color: #6ab0e0; }
          }
        </style>
      </head>
      <body>

        <!-- Header -->
        <header class="site-header">
          <nav class="site-nav">
            <a href="https://europe-weekly.eu" class="nav-main">Europe Weekly</a>
            <a href="https://europe-weekly.eu/articles.html" class="nav-sub">Articles</a>
            <a href="https://europe-weekly.eu/episodes.html" class="nav-sub">All Episodes</a>
          </nav>
        </header>

        <!-- Main -->
        <main>

          <h1 class="feed-heading"><xsl:value-of select="/rss/channel/title"/> &#8211; Podcast Feed</h1>

          <xsl:if test="/rss/channel/description != ''">
            <p class="feed-desc"><xsl:value-of select="/rss/channel/description"/></p>
          </xsl:if>

          <div class="rss-pill-row">
            <span class="rss-pill">RSS Feed &#8212; copy URL into your podcast app</span>
            <a class="rss-url" href="https://europe-weekly.eu/podcast-feed.xml">
              https://europe-weekly.eu/podcast-feed.xml
            </a>
          </div>

          <p class="section-label">
            <xsl:value-of select="count(/rss/channel/item)"/>
            <xsl:text> Episodes</xsl:text>
          </p>

          <xsl:for-each select="/rss/channel/item">
            <a class="ep-card" href="{link}">
              <span class="ep-badge">
                <xsl:text>S</xsl:text><xsl:value-of select="itunes:season"/>
                <xsl:text> &#183; Ep </xsl:text><xsl:value-of select="itunes:episode"/>
                <xsl:if test="itunes:duration != ''">
                  <xsl:text> &#183; </xsl:text><xsl:value-of select="itunes:duration"/>
                </xsl:if>
              </span>
              <p class="ep-title"><xsl:value-of select="title"/></p>
              <xsl:if test="description != ''">
                <p class="ep-desc"><xsl:value-of select="description"/></p>
              </xsl:if>
              <div class="ep-meta">
                <xsl:if test="pubDate != ''">
                  <span><xsl:value-of select="pubDate"/></span>
                </xsl:if>
                <span>Listen &#8594;</span>
              </div>
            </a>
          </xsl:for-each>

        </main>

        <!-- Footer -->
        <footer class="site-footer">
          <xsl:value-of select="/rss/channel/copyright"/>
          <xsl:text> &#183; </xsl:text>
          <a href="https://europe-weekly.eu">europe-weekly.eu</a>
        </footer>

      </body>
    </html>
  </xsl:template>

</xsl:stylesheet>
