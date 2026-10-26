# Tasks

## 1. Options

- [x] 1.1 Add the `{ pattern, description }` rule to `OptionRule`, `followsRule` and `describeRule`, and declare it on `resizeScale` (positive percentages); add a registry check and `main` tests that `0%`, `50` and `abc` are rejected
- [x] 1.2 Add optional `checkOptions` to `Mode`, call it in `main` after the option value checks and before inputs, and give `resize` its check (conflict between `--scale` and `--width`/`--height`; none given); add `main` tests for both messages, exit code `1`, no `-o` folder created, and the check winning over a missing input

## 2. Resize step

- [x] 2.1 Add `src/convert/resize.ts` with `planSize` (scale, one side, both sides per fit, rounding, at least 1 pixel) and `applyResize` (Lanczos, centre position, background for contain, sharpen for enlarge); add unit tests for every fit on a wide and a tall source, one-side shapes, scales and rounding
- [x] 2.2 Make `openCore` report the displayed (oriented) size and the page height for animations; make `openSvg` plan once on its natural size, choose its density from that plan, return it as `opened.plan`, and drop its own exact-size resize
- [x] 2.3 Use the plan in `convertImage` (`opened.plan` for SVG, otherwise planned on the opened size): `--no-enlarge` with its note, the 16384 limit message, and `applyResize` before grayscale and flatten; render the resized image to a PNG buffer before making ICO sizes; with `keepFormat` and an ICO target, write one square icon at the result's larger side, refusing sides over 256
- [x] 2.4 Give `resize` and `enlarge` lazy `run`s through `convertImage(context, input.format, { keepFormat: true })`, with `enlarge` reading `2x`/`4x` case-insensitively and sharpening; run `npm run docs` and keep whatever it generates

## 3. Tests

- [x] 3.1 Add `test/resize.test.ts` through `main`:
  - `resize` with no size fails with "Give --width, --height or --scale",
  - `enlarge` with no options doubles,
  - `--width 800` on 1600 × 1200 gives 800 × 600,
  - `enlarge --scale 4x` on 400 × 300 gives 1600 × 1200,
  - each `--fit` on wide and tall images gives the expected sizes,
  - `cover` crops from the centre,
  - `--scale 50%` and `200%`,
  - a folder of icons enlarges,
  - `--width 1` works, and `0`, `-5` and `abc` are rejected,
  - `--no-enlarge` keeps 400 × 300 with a note,
  - a 333.5-pixel result is rounded,
  - 1 × 1 enlarges to 2 × 2,
  - over 16384 is refused with its would-be size,
  - `enlarge --scale 3x`, `1x` and `abc` list `2x` and `4x`,
  - `heictojpg --width 24` on `test/fixtures/iphone.heic` (displayed 48 × 64) gives a 24 × 32 JPG, shrinking while converting,
  - `pngtoico --width 64 --height 32 --fit cover` gives icons from the cropped image,
  - `enlarge` on a 48-pixel ICO gives a single 96-pixel icon, and `resize --width 300` on an ICO is refused as over 256,
  - `enlarge --scale 2X` works,
  - an animated GIF stays animated,
  - a transparent PNG stays transparent after resize and enlarge,
  - `--strip-metadata` with both tools,
  - `--scale` with `--width` is rejected,
  - output names `-resized` and `-enlarged` keep the format,
  - the screenshots and print scenario
  
  Verify the tests pass, together with feature 7's SVG tests.

## 4. Decisions and final checks

- [x] 4.1 Update `Decisions.md`: mark the feature 6 "no effect until feature 9" gap and the feature 7 SVG one-pixel correction as resolved by feature 9; add that `contain` pads with transparency, or with `--background` where transparency can't be kept, and that `--scale` for `resize` must include `%`
- [x] 4.2 Run `npm run format`, `npm run check`, `npm test`, `npm run build` and `npm run docs`, fixing every issue until all pass
- [x] 4.3 Tick "9. Resize and enlarge" in the `Features.md` progress list
