#!/bin/sh
# Regenerates the PWA image assets (requires ImageMagick `magick`):
#   - manifest screenshots from the landing captures
#   - iOS splash screens (apple-touch-startup-image) from the logo
#   - 180x180 apple-touch-icon
#   - optimized logo.png (source is 1024px / 1.6MB; the app renders it small)
# Run from apps/web:  sh scripts/generate-pwa-assets.sh
set -eu

cd "$(dirname "$0")/.."

LOGO_SRC="public/logo.png"
LANDING="../landing/public"
SPLASH_BG="#ffffff"

mkdir -p public/screenshots public/splash

# --- Manifest screenshots (sizes must match manifest.json) -----------------
magick "$LANDING/hero-screenshot.png" -resize 1280x720^ -gravity center -extent 1280x720 \
    -strip public/screenshots/desktop-wide.png
magick "$LANDING/app-mobile.png" -resize 390x844^ -gravity center -extent 390x844 \
    -strip public/screenshots/mobile-narrow.png

# --- Apple touch icon (real 180px, not a scaled 192) ------------------------
magick "$LOGO_SRC" -resize 180x180 -strip public/icons/apple-touch-icon-180x180.png

# --- iOS splash screens ------------------------------------------------------
# Logo centered on a flat background at 25% of the short edge. One file per
# device class, portrait and landscape; index.html carries the matching
# media-query link tags.
splash() {
    w="$1"; h="$2"
    short=$(( w < h ? w : h ))
    logo=$(( short / 4 ))
    # PNG8: logo on a flat background quantizes losslessly enough and keeps
    # the 32-file set a few MB instead of 11MB.
    magick -size "${w}x${h}" "xc:${SPLASH_BG}" \
        \( "$LOGO_SRC" -resize "${logo}x${logo}" \) \
        -gravity center -composite -strip -colors 255 \
        -define png:compression-level=9 "public/splash/splash-${w}x${h}.png"
}

# iPhone (portrait px)
for size in "1320 2868" "1206 2622" "1290 2796" "1179 2556" "1170 2532" \
            "1125 2436" "1242 2688" "828 1792" "1242 2208" "750 1334"; do
    set -- $size
    splash "$1" "$2"
    splash "$2" "$1"
done

# iPad (portrait px)
for size in "2048 2732" "1668 2388" "1640 2360" "1668 2224" "1620 2160" "1488 2266"; do
    set -- $size
    splash "$1" "$2"
    splash "$2" "$1"
done

# --- Recompress manifest icons (keep only when smaller) ---------------------
for icon in public/icons/icon-*.png public/icons/shortcut-*.png; do
    magick "$icon" -strip -colors 255 -define png:compression-level=9 "${icon}.opt"
    if [ "$(wc -c < "${icon}.opt")" -lt "$(wc -c < "$icon")" ]; then
        mv "${icon}.opt" "$icon"
    else
        rm "${icon}.opt"
    fi
done

# --- Optimize the oversized logo --------------------------------------------
# Rendered at <=64px in the UI and on share cards; 512px is plenty.
magick "$LOGO_SRC" -resize 512x512 -strip png:- > public/logo.optimized.png
if [ "$(wc -c < public/logo.optimized.png)" -lt "$(wc -c < "$LOGO_SRC")" ]; then
    mv public/logo.optimized.png "$LOGO_SRC"
else
    rm public/logo.optimized.png
fi

echo "Done. Generated $(ls public/splash | wc -l | tr -d ' ') splash screens."
