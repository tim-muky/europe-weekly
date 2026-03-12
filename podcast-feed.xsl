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
            background: #F1F1EC;
          }

          /* ── HEADER ── */
          .feed-header {
            background: #F1F1EC;
            padding: 20px 36px 0;
            border-bottom: 1.5px solid #ccc;
          }
          .feed-nav {
            display: flex;
            flex-direction: column;
            gap: 4px;
            margin-bottom: 16px;
          }
          .site-link {
            font-size: 1.15rem;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: 0.02em;
            text-decoration: none;
            color: #111;
          }
          .site-link:hover { text-decoration: underline; }

          /* ── MAIN ── */
          main {
            background: #c5daea;
            min-height: calc(100vh - 140px);
          }

          .feed-intro {
            padding: 28px 36px 24px;
          }
          .feed-title {
            font-size: 0.95rem;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: 0.03em;
            margin-bottom: 10px;
          }
          .feed-desc {
            font-size: 0.88rem;
            line-height: 1.6;
            color: #333;
            margin-bottom: 14px;
          }
          .rss-notice {
            display: inline-block;
            background: #f5f064;
            color: #111;
            font-size: 0.72rem;
            font-weight: 700;
            padding: 4px 12px;
            border-radius: 20px;
            margin-bottom: 6px;
          }
          .rss-url {
            display: block;
            font-size: 0.78rem;
            color: #1a6ba8;
            word-break: break-all;
            margin-top: 6px;
            text-decoration: none;
          }
          .rss-url:hover { text-decoration: underline; }

          /* ── EPISODE LIST ── */
          .episodes-section {
            padding: 0 36px 48px;
          }
          .episodes-heading {
            font-size: 0.78rem;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            color: #4a6a8a;
            margin-bottom: 14px;
            padding-bottom: 6px;
            border-bottom: 1px solid #aac4d8;
          }

          .ep-card {
            background: #1c3252;
            color: #fff;
            border-radius: 4px;
            padding: 18px 22px 20px;
            margin-bottom: 14px;
            text-decoration: none;
            display: block;
            transition: opacity 0.15s;
          }
          .ep-card:hover { opacity: 0.88; }

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
            color: #fff;
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

          /* ── FOOTER ── */
          .feed-footer {
            background: #1c3252;
            color: #fff;
            text-align: center;
            padding: 18px;
            font-size: 0.82rem;
          }
          .feed-footer a { color: #fff; text-decoration: none; }
          .feed-footer a:hover { text-decoration: underline; }

          @media (max-width: 600px) {
            .feed-header, .feed-intro, .episodes-section { padding-left: 18px; padding-right: 18px; }
          }
        </style>
      </head>
      <body>

        <!-- Header -->
        <header class="feed-header">
          <nav class="feed-nav">
            <a href="https://europe-weekly.eu" class="site-link">Europe Weekly</a>
            <a href="https://europe-weekly.eu/articles.html" class="site-link" style="font-size:0.82rem;font-weight:700;opacity:0.6">Articles</a>
            <a href="https://europe-weekly.eu/episodes.html" class="site-link" style="font-size:0.82rem;font-weight:700;opacity:0.6">Podcast</a>
          </nav>
        </header>

        <!-- Main -->
        <main>

          <!-- Intro block -->
          <section class="feed-intro">
            <h1 class="feed-title"><xsl:value-of select="/rss/channel/title"/> – Podcast Feed</h1>
            <p class="feed-desc"><xsl:value-of select="/rss/channel/description"/></p>
            <span class="rss-notice">RSS Feed – copy URL into your podcast app</span>
            <a class="rss-url" href="https://europe-weekly.eu/podcast-feed.xml">
              https://europe-weekly.eu/podcast-feed.xml
            </a>
          </section>

          <!-- Episode list -->
          <section class="episodes-section">
            <p class="episodes-heading">Episodes (<xsl:value-of select="count(/rss/channel/item)"/>)</p>

            <xsl:for-each select="/rss/channel/item">
              <a class="ep-card" href="{link}">
                <span class="ep-badge">
                  <xsl:text>Season </xsl:text>
                  <xsl:value-of select="itunes:season"/>
                  <xsl:text> · Ep </xsl:text>
                  <xsl:value-of select="itunes:episode"/>
                  <xsl:if test="itunes:duration">
                    <xsl:text> · </xsl:text>
                    <xsl:value-of select="itunes:duration"/>
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
                  <span>Listen →</span>
                </div>
              </a>
            </xsl:for-each>

          </section>
        </main>

        <!-- Footer -->
        <footer class="feed-footer">
          <xsl:value-of select="/rss/channel/copyright"/>
          <xsl:text> · </xsl:text>
          <a href="https://europe-weekly.eu">europe-weekly.eu</a>
        </footer>

      </body>
    </html>
  </xsl:template>

</xsl:stylesheet>
