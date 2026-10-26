# konvertoj — Decisions

Decisions taken while building the features in [Features.md](Features.md) that go beyond, or differ from, what the plan says. Each one says what was decided and why.

## 5. Format detection

- **Conversion-dependent tests finish in features 6 and 7.** Three of feature 5's tests need a real converter: "converts fine with `tojpg`", "a mixed folder of HEIC, PNG and WebP files all convert with `tojpg`", and "a truncated or corrupt image fails with 'looks damaged'". No converter exists until feature 6. Feature 5 tests these up to the point where the right converter would be chosen: the file passes its checks and its detected format is handed to the mode. Features 6 and 7 add the full conversion checks. A truncated image can't be caught from its header, so "looks damaged" for truncated images comes from the converters, using the shared message added in feature 5.
- **Unusable files in a mixed folder count as failed, not skipped.** Features.md says a user running `tojpg` on a messy folder gets "a clear list of what was skipped". konvertoj lists text files, videos and other unusable files with their reasons, but counts them as *failed*, so the exit code is `2`. Feature 4's reporter and exit codes treat a file konvertoj couldn't process as a failure. "Skipped" is kept for files that need no work, such as a JPG given to `tojpg`. Scripts can then tell "nothing to do" apart from "couldn't do it".
- **`--strip-metadata` counts as a conversion option.** A JPG given to `tojpg` is converted, not skipped, when `--strip-metadata` is given, because removing details is a reason to rewrite the file (feature 8).
- **Real HEIC test photos are made with a script.** `test/fixtures/iphone.heic` and `test/fixtures/burst.heic` are made on macOS by `test/fixtures/make-fixtures.swift`, using Apple's own HEIC encoder. A real iPhone photo would hold a real location, so these small camera-style photos stand in for one. They have Apple camera details, a date, a GPS position and a rotation, like an iPhone photo.
- **Format checks are skipped for the test-only `copy` mode.** The runner checks formats only for modes whose input formats konvertoj knows. Every real mode qualifies. The `copy` mode used to test the runner takes `txt` files, which aren't a real format, so its tests keep working without image headers.

## 6. Core image conversion

- **TIFF is lossless unless `--quality` is given.** Features.md gives each format a default quality, "e.g. 80 for JPG". TIFF is mostly used for scans and archive copies, so quietly making it lossy would surprise people. A TIFF is saved with lossless LZW compression by default. `--quality` makes a smaller, JPEG-compressed TIFF at that quality, filled onto `--background`, because JPEG compression can't hold transparency. TIFF's `--quality` therefore has no default in the help.
- **Notes are visible lines.** Features.md asks for "a note" in some cases, such as when an animated GIF becomes a single-frame JPG. Notes are printed as `  Note: …` under the file's `✓` line, and hidden by `--quiet`. A multi-page TIFF gets "only the first page was kept", because it isn't an animation.
- **`transparent` isn't accepted as a colour.** Filling lost transparency with "transparent" comes out black, which no one wants. `rotate` already uses transparent corners when no `--background` is given.
- **Colour names are checked by konvertoj itself.** The 148 CSS colour names, hex and `rgb()` are checked before any file is read, so a wrong `--background` fails once, at the start, without loading `sharp`. Doing this through sharp's own colour package would have meant depending directly on a package konvertoj doesn't list.
- **Temporary gaps until features 7 and 9.** Until feature 9, `--width`, `--height` and `--fit` are accepted by conversion modes but have no effect. Until feature 7, HEIC, SVG, BMP and ICO inputs to `to<format>` modes fail as "can't be converted yet". Neither gap reaches a release, because v1.0.0 is only published once every feature is done. *Both gaps are now closed: feature 7 added the formats and feature 9 the resizing.*

## 7. Other image formats

- **BMP is written as 24-bit.** Transparency in BMP files is poorly supported, so BMP is treated like JPG: transparent areas are filled with `--background` (white by default). BMPs whose alpha channel is unused (all zero, as in most 32-bit BMPs) are read as opaque. konvertoj re-orders bmp-ts's raw pixels itself, because the library's own RGBA option gives wrong colours for 8-bit palette BMPs.
- **SVGs are read from memory.** sharp loads images an SVG links to when it is given the SVG's file path, but not when it is given the SVG's contents. konvertoj always passes the contents, so linked files and URLs are never loaded.
- **SVG size rules.** An SVG keeps its own size only when its root tag has both `width` and `height` (in any absolute unit, such as px, pt or cm). Otherwise konvertoj writes `width="512"` and a height that keeps its `viewBox` shape into the root tag, in memory, before drawing. librsvg can't size an SVG that has neither a full size nor a `viewBox`. `--width` and `--height` set the drawing resolution for SVGs. *Since feature 9, the SVG is drawn at least as large as the planned size and the shared resize step makes it exact, replacing feature 7's one-pixel correction.* `--dpi` is capped at 7200, and sizes needing more than sharp's maximum density fail with "would be too large to draw at that size".
- **The burst fixture's main image is its first image.** Apple's ImageIO, which makes `test/fixtures/burst.heic`, always marks the first image as the primary one. The test checks that only the main 80 × 40 image is converted, and not the second 32 × 32 one.
- **Checking ICO files without a browser.** Features.md asks that ICOs open in a browser and in Windows. The test suite has neither, so it checks that the file is a standard ICO container: a valid header and directory, 256 recorded as 0, and PNG entries. Browsers and Windows Vista and later read that format.
- **libheif's console output is silenced.** The HEIC decoder prints "Could not parse HEIF file" by itself on damaged files. konvertoj silences it while decoding, so users only see the plain-English "looks damaged" message.
- **Library errors aren't mistaken for file-system errors.** Errors are treated as file-system problems only when they carry a system call, because some decoders throw Node.js `ERR_OUT_OF_RANGE` errors on malformed files, and those mean the file looks damaged.

## 8. Metadata and strip

- **TIFF can't hold camera details.** Features.md lists TIFF among the formats that keep details. sharp can't write EXIF into TIFF files, so a TIFF keeps XMP and its colour profile, but loses the camera, date and location. `--verbose` says so.
- **Outputs carry an sRGB colour profile.** Feature 6 converts colours to sRGB. Copying the input's original profile (for example Display P3) would then describe the wrong colours, so every output that can hold a profile gets the sRGB one instead.
- **HEIC orientation is written as normal.** A HEIC's pixels come out of the decoder already upright, so the orientation copied into the output is 1. Copying the photo's original orientation would turn it a second time.
- **`strip` keeps JPG pictures exactly.** An upright JPG has its detail blocks (EXIF, XMP, IPTC, comments and non-colour APP2 blocks) removed directly, with no re-compression, so the picture doesn't get worse. Anything stored after the JPG's end is removed too: extra images such as depth or gain maps, and motion-photo videos, which can carry their own location. Other cases are re-encoded without details: PNG, TIFF and lossless WebP losslessly, and lossy WebP, AVIF and sideways JPGs at their default quality.
- **Unreadable details are left out, with a visible warning.** A corrupted EXIF block is otherwise copied as it is. konvertoj checks EXIF with `exifr` (from the tech stack), and leaves it out, with a `Note:` line, when `exifr` can't read it cleanly.
- **IPTC details aren't copied.** sharp has no way to keep IPTC. They are dropped on conversion, and also removed by `--strip-metadata` and `strip`.

## 9. Resize and enlarge

- **`contain` padding.** `--fit contain` pads with transparency where the format keeps it, and with `--background` (white by default) for JPG, BMP and TIFF with a quality. Features.md doesn't say what the padding is.
- **`resize --scale` needs a `%`.** `--scale 50%` and `--scale 200%` work. A bare `50` is rejected, so it can't be mistaken for 50 pixels or 50 times.
- **Resizing an icon makes one icon.** `resize` and `enlarge` on an ICO write a single square icon at the new size, up to 256 pixels, the largest an ICO entry can be. Conversions to ICO still use `--sizes`.
- **Option checks per mode.** Modes can declare rules across their options, such as `resize`'s "Give --width, --height or --scale" and the `--scale`/`--width` conflict. They are checked before any file is read, so a wrong command fails at once. Features 10 to 12 use the same hook.

## 10. Compress

- **GIF compression shares pixels between frames.** Features.md says GIFs use fewer colours. sharp's colour setting barely changes GIF output (anything from 17 to 256 colours gives the same file), so lowering quality instead lets neighbouring frames share more pixels and palettes, which clearly shrinks animated GIFs. A still GIF usually can't get smaller this way, and is reported as "already optimised".
- **The target-size search assumes bigger files at higher quality.** That holds for JPG. WebP, AVIF and palette PNG sizes can dip slightly at some qualities, so for them the result is the highest fitting quality the search found, within the 8 attempts Features.md allows.
- **1 KB = 1024 bytes** for `--target-size`, matching the sizes konvertoj prints.
- **Every success line shows the size change.** Features.md shows `hero.jpg 2.4 MB → 410 KB (−83%)` for compress. Every mode's `✓` line now ends with the percentage, like the summary, so the format is the same everywhere.
- **One of `--quality`, `--level` and `--target-size`.** Features.md rejects `--quality` with either of the others. `--level` with `--target-size` is also rejected, because they contradict each other in the same way.
- **Kept details can make small files "already optimised".** `compress` keeps camera details and writes an sRGB profile, like every conversion. For a tiny, well-compressed file those few hundred bytes can make the result bigger, and the file is then left alone. `--strip-metadata` removes them.
- **Tools that keep the format follow the real format.** A PNG named `screen.jpg` given to `compress`, `resize`, `enlarge` or `strip` is saved as `screen-compressed.png`, with a note, rather than writing PNG data into a `.jpg` file.
- **A closed output pipe doesn't stop the work.** When konvertoj's output is piped into a command that stops reading early, such as `head`, konvertoj stops printing but finishes the files it was working on, and exits with its normal code. Without this, Node.js would crash with an EPIPE error and could leave work half done.
