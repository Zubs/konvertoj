# Tasks

## 1. Converter hooks

- [x] 1.1 Add `edit` (returning `Sharp`) and `resize: false` to `ConvertSettings`; run `edit` in `renderImage` where the resize goes; with `resize: false` pass an empty size request to `openImage` and make no plan; take the kept-format ICO side from the rendered base image (refusing over 256) instead of the planned size
- [x] 1.2 Pass the opened image's `delay` and `loop` into `gif()` and `webp()` for animated inputs; verify existing animation tests pass

## 2. Edits

- [x] 2.1 Add `src/convert/edit.ts` with `cropImage` (trim as an `extract` of a box measured on the first frame for animations, with the no-border note, aspect area, width/height at `--left`/`--top` or `--position`, the past-the-edge message with the real size checked size-first, `extract`), `rotateImage` (angle normalising, 0 unchanged, corner colour, still `rotate`, animated frame-by-frame rotation and re-joining) and `flipImage`, each built as a closure over the run's `context`; the `rotate` run returns `{ skipped: "already upright" }` for `--auto` without `--angle` when the orientation tag is missing or 1, before converting
- [x] 2.2 Add the `--aspect` pattern rule and `checkOptions` for `crop`, `rotate` and `flip` with the messages in design.md; give the three tools lazy `run`s; run `npm run docs`

## 3. Tests

- [x] 3.1 Add `test/edit.test.ts` through `main`:
  - `crop` with no options lists the ways to crop,
  - `rotate` with neither option gives the usage hint,
  - a centred 800 × 800 crop of 1600 × 1200,
  - `--angle 90` turns 800 × 600 into 600 × 800,
  - horizontal and vertical flips,
  - each `--position`,
  - `--aspect 1:1` gives 1200 × 1200 and `16:9` gives 1600 × 900,
  - `90`, `180`, `270` and `-90` turn the right way,
  - an exact-size crop of a PNG keeps every pixel,
  - `--width 2000 --position right` on a 1600-wide image gives the past-the-edge message,
  - a past-the-edge crop gives the real size,
  - `0` and `360` keep every pixel of a PNG,
  - `--auto --angle 90` on a sideways photo turns it upright and then by 90,
  - `45` gives transparent PNG corners and white JPG corners,
  - `--trim` removes a white border, and keeps a borderless image with a note,
  - `--auto` fixes a sideways photo and skips an upright one,
  - an animated GIF stays animated, with its delays, through rotate, flip, crop and `--trim`,
  - a cropped ICO keeps its new size,
  - `--aspect 0:9`, `16` and `abc`, and `--angle abc`, are rejected,
  - `--left` without `--top`, and `--aspect` with `--trim`, are rejected,
  - `flip` with no or an unknown direction lists both,
  - the social-media and scans scenario
  
  Verify the tests pass.

## 4. Decisions and final checks

- [x] 4.1 Add feature 11 entries to `Decisions.md`: `crop` needs both `--width` and `--height`; `--auto` skips already-upright photos; animated images are rotated frame by frame, and an animated WebP rotated this way loses its EXIF/XMP; `--trim` on animations uses the first frame's border; edits re-encode at the default quality
- [x] 4.2 Run `npm run format`, `npm run check`, `npm test`, `npm run build` and `npm run docs`, fixing every issue until all pass
- [x] 4.3 Tick "11. Crop, rotate and flip" in the `Features.md` progress list
