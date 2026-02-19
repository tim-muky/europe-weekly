#!/bin/bash
# Deploy script for Europe Weekly website

echo "Building Europe Weekly website..."

# Check if we're in the right directory
if [ ! -f "_config.yml" ]; then
    echo "Error: Must run from website root directory"
    exit 1
fi

# Install dependencies
echo "Installing dependencies..."
bundle install

# Build the site
echo "Building site..."
bundle exec jekyll build

# Instructions for GitHub Pages
echo ""
echo "✅ Build complete!"
echo ""
echo "To deploy to GitHub Pages:"
echo "1. Create a new GitHub repo: europe-weekly-website"
echo "2. Copy the _site folder contents to the repo"
echo "3. Push to main branch"
echo "4. Enable GitHub Pages in repo settings"
echo "5. Add custom domain: europe-weekly.eu"
echo ""
echo "Or for manual hosting:"
echo "- Upload _site folder contents to your web server"
