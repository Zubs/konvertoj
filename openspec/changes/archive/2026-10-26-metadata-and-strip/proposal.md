# Proposal

## Why

Spec.md's quality bar says photo details such as camera and location are kept unless the user asks for them to be removed. Today every conversion silently drops them, because sharp strips metadata by default. People also need the opposite: a quick way to remove location details before sharing photos online. Feature 8 does both, and adds the `strip` tool.

## What Changes

- **Details kept by default.**
  - EXIF (camera, date, GPS) and XMP are copied to JPG, PNG, WebP and AVIF outputs.
  - Colours stay converted to sRGB (feature 6), and the output now carries an sRGB colour profile, so the profile always matches the pixels.
  - TIFF keeps XMP and the colour profile. sharp can't write EXIF into TIFF files, so camera details are dropped there, with a verbose note (see Decisions.md).
- **HEIC details.** For HEIC input, the camera (make, model, lens), date taken and GPS position are read with `exifr` and written into the output with sharp. The orientation is written as normal (1), because the HEIC's pixels are already turned upright.
- **Formats without details.** Converting to BMP, GIF or ICO works as before. When the input had details, `--verbose` notes that they were dropped because the format can't hold them. TIFF output gets the same note for camera details.
- **`--strip-metadata`** on any image mode removes EXIF, XMP and IPTC details and keeps only the sRGB colour profile. The image is turned upright first, so it is never left sideways without its orientation tag.
- **`strip` tool.** Keeps the format and only removes details, saved as `<name>-stripped.<ext>`.
  - A JPG that is already upright has its detail blocks removed directly, so its picture data is kept exactly, with no re-compression.
  - Any other case is re-encoded with sharp without details: PNG, TIFF and lossless WebP losslessly, lossy WebP and AVIF at their default quality, and a sideways JPG at its default quality after turning it upright.
  - Anything stored after a JPG's end (extra images such as depth maps, or motion-photo videos, which can hold their own location) is removed.
- **Damaged details.** If an input's EXIF can't be read, it still converts: the details are left out and a visible note warns about it.
- Tick "8. Metadata and strip" in `Features.md` once everything passes.

## Capabilities

### New Capabilities

- `image-metadata`: which photo details are kept, written, dropped or removed for each format, `--strip-metadata`, the `strip` tool, and damaged details.

### Modified Capabilities

- `image-conversion`: "Upright and sRGB" now says the output carries an sRGB colour profile, instead of none.

## Impact

- New dependency: `exifr` (listed in the CLAUDE.md tech stack). It is loaded only when an image is converted.
- New source: `src/convert/metadata.ts`, which reads and checks details, writes HEIC details, and removes JPG detail blocks.
- Changed source:
  - `src/convert/image.ts`: keeps or strips details, and adds the dropped-details notes,
  - `src/modes/registry.ts`: `strip` gets a `run`.
- `Decisions.md` gains entries for TIFF camera details, the sRGB profile, the HEIC orientation, lossless JPG stripping and the damaged-details warning.
