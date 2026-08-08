#!/bin/bash
# Requires: imagemagick (convert) or inkscape
# Run: bash generate-icons.sh

SVG="icons/icon.svg"
OUT="icons"

if command -v magick &> /dev/null; then
  CONVERT="magick"
elif command -v convert &> /dev/null; then
  CONVERT="convert"
elif command -v inkscape &> /dev/null; then
  CONVERT="inkscape"
else
  echo "Install ImageMagick or Inkscape to generate icons"
  exit 1
fi

for size in 16 32 48 64 128 256; do
  if [[ "$CONVERT" == "inkscape" ]]; then
    inkscape "$SVG" --export-type=png --export-filename="$OUT/${size}x${size}.png" -w $size -h $size
  else
    $CONVERT -background none -resize ${size}x${size} "$SVG" "$OUT/${size}x${size}.png"
  fi
done

# Create ICO
if [[ "$CONVERT" != "inkscape" ]]; then
  $CONVERT "$OUT/16x16.png" "$OUT/32x32.png" "$OUT/48x48.png" "$OUT/64x64.png" "$OUT/128x128.png" "$OUT/256x256.png" "$OUT/icon.ico"
fi

echo "Icons generated in $OUT/"
