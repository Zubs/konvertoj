# Proposal

## Why

Cropping to a shape for social media, trimming screenshot borders, fixing pages scanned upside down and mirroring selfies are everyday edits (Spec.md 5.2). `crop`, `rotate` and `flip` are registered with their options but can't run. Feature 11 makes them work, reusing the image converter so formats, details, animation and naming behave as they do everywhere else.

## What Changes

- **`crop`**, saved as `<name>-cropped.<ext>`:
  - **Exact area:** `--width`, `--height`, `--left`, `--top`.
  - **Position:** `--width`, `--height` and `--position` (nine places, default `center`).
  - **Aspect ratio:** `--aspect 16:9` crops the largest area with that ratio, placed by `--position`.
  - **Trim:** `--trim` removes plain borders that match the top-left corner's colour. An image with no border is left unchanged, with a note.
  - **Limits:** a crop exactly the image's size gives the same image. A crop past the edge fails, giving the image's real size.
  - **Checked before any file is read:**
    - no crop option → a list of the ways to crop,
    - `--left` without `--top` (or the reverse), `--left`/`--top` without `--width` and `--height`, or only one of `--width` and `--height` → incomplete,
    - `--aspect` with `--trim`, `--width`, `--height`, `--left` or `--top`, `--trim` with any other crop option, or `--position` with `--left`/`--top` → conflicting,
    - `--aspect` must be two positive numbers, such as `16:9`, so `0:9`, `16` and `abc` are rejected.
- **`rotate`**, saved as `<name>-rotated.<ext>`:
  - `--angle <degrees>` takes any angle, positive or negative. Multiples of 90 turn the image exactly, and `0` and `360` leave it unchanged.
  - Other angles enlarge the canvas. The corners are transparent where the format allows, and white otherwise, unless `--background` is given.
  - `--auto` turns the image upright using its orientation tag and clears the tag. A photo that is already upright is skipped with "already upright".
  - Neither `--angle` nor `--auto` → a usage hint.
- **`flip`**, saved as `<name>-flipped.<ext>`: `--direction horizontal` mirrors left to right, and `vertical` top to bottom. A missing direction fails, listing both.
- **Animation:**
  - rotating or flipping an animated GIF or WebP keeps it animated, with its frame delays and loop count,
  - sharp can't rotate multi-page images, so animated images are rotated frame by frame and joined again,
  - cropping keeps animation too.
- **Format and details:** these tools keep the format, details and colour profile like `resize`, and honour `--strip-metadata`.
- Tick "11. Crop, rotate and flip" in `Features.md` once everything passes.

## Capabilities

### New Capabilities

- `image-editing`: the `crop`, `rotate` and `flip` tools, every crop method, their limits and option rules, rotation by any angle, `--auto`, and animation.

### Modified Capabilities

- `mode-registry`: "Option value rules" covers `crop`'s `--aspect`.
- `command-line`: the "unchecked values pass through" example moves to `--page`, because `--aspect` is now checked.

## Impact

- New source: `src/convert/edit.ts`, which works out crop regions, rotates (including frame by frame) and flips.
- Changed source:
  - `src/convert/image.ts`: `ConvertSettings` gains an `edit` step and a way to skip resizing (crop reuses `--width`/`--height`), and GIF/WebP encoding keeps frame delays and loop counts,
  - `src/modes/registry.ts`: `run` and `checkOptions` for `crop`, `rotate` and `flip`,
  - `src/modes/options.ts`: the `--aspect` pattern rule.
