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

## 11. Crop, rotate and flip

- **`crop` needs both `--width` and `--height`.** Features.md lists them together for both the exact-area and position methods. Giving only one is rejected as incomplete rather than guessing the other side.
- **`rotate --auto` skips photos that are already upright.** Features.md says `--auto` "changes nothing" on an upright photo. Such photos, and BMP and ICO files, which have no orientation tag, are reported as skipped with "already upright", and nothing is written. With `--angle` as well, the photo is always turned upright and then rotated.
- **Animated images are rotated frame by frame.** sharp can't rotate multi-page images, so each frame is rotated on its own and the frames are joined again, keeping delays and loop count. An animated WebP rotated this way loses its EXIF and XMP, because the rebuilt frames carry none. Animated WebPs rarely have camera details.
- **`--trim` on an animation uses the first frame's border** for every frame, because sharp can't trim multi-page images directly.
- **Edits re-encode the image.** Cropping, rotating and flipping save the image again at the format's default quality, like `resize`. There is no lossless JPEG rotation.
- **Fixed in passing:** the test that compares `-o` and `--output` now ignores the run time in the summary, because the conversion really runs and its duration can differ by a tenth of a second.
- **Edited icons are one square icon.** `crop`, `rotate` and `flip` on an ICO write a single icon at the edited image's larger side, as `resize` and `enlarge` do. ICO entries are square, so a non-square result is padded with transparency to a square, the same way conversions to ICO are.
- **Animated vertical flips go frame by frame.** Flipping the whole animation at once would reverse the frame order, so each frame is flipped on its own, like rotation.

## 12. Info and colour picker

- **Details are printed after the batch, in input order.** `info` and `colorpick` work on several files at once, so each file's section is held until all are done and then printed in the order given. Output stays readable and predictable.
- **`--json` is always an array.** Even for one file, standard output is a JSON array of objects, so scripts handle one file and many the same way. Nothing else is printed on standard output in this mode. Verbose lines, skips and notes go to standard error.
- **`--quiet` keeps the sections.** The details are the command's result, not progress, so `--quiet` doesn't hide them.
- **`--palette` needs a number.** Features.md gives it a default of 5, but a value option given on its own would take the next word, such as a file name, as its count. `--palette 5` is therefore needed, and the help says "e.g. 5".
- **Colours are given as HEX, RGB and HSL only,** with the alpha added when a colour isn't fully opaque. konvertoj doesn't name colours.
- **`-o` is rejected for modes that only print.** `info` and `colorpick` don't create files, so `-o` fails with an explanation instead of being silently ignored.
- **Main colours use a median-cut variant that splits at the mean.** Features.md asks for median-cut quantisation. Classic median cut, splitting the widest box at its median, gave wrong colours on JPGs: compression leaves pinkish edge pixels that won the splits, and two light colours were merged. konvertoj still cuts colour boxes in two along one channel, but at the mean, and always makes the split that reduces the total colour error most. On a five-colour brand image this gives all five colours, for PNG and JPG alike.
- **Modes that only print don't take file options.** `info` and `colorpick` don't accept or list `-o`, `--overwrite` or `--strip-metadata`, so `info --strip-metadata` can't make anyone think a file was cleaned.
- **Ctrl+C says what it's doing.** The first Ctrl+C prints "Stopping. Press Ctrl+C again to stop at once." (worded generally since feature 14, because it can also arrive during the video add-on prompt or download). A second Ctrl+C removes temporary files and ends konvertoj immediately, even while sharp is busy encoding, with exit code 130.

## 13. PDF

- **`--page-size fit` uses one point per pixel.** Each page is exactly the image's pixel size in points, so the PDF holds every pixel. Printed, such pages come out at 72 dpi.
- **Small images aren't enlarged on A4 or letter pages.** Features.md says large images are scaled down and small ones centred. A small image is drawn at its own size in the middle of the page, never blown up and blurred.
- **How images go into the PDF.** Upright RGB or grayscale JPGs are embedded byte for byte. Everything else, including sideways and CMYK JPGs (which some readers show inverted), is turned upright and converted: to PNG when it has transparency, otherwise to JPG at quality 90. Every image is fully decoded first, so a truncated JPG stops the PDF with its name instead of ending up as a broken page.
- **Pages are drawn onto a background.** PDF pages are exported onto `--background` (white by default), so the images are always opaque, and a transparent area of the page shows that colour.
- **Page exports are always folders of numbered files.** `-o` is a folder for the `pdfto` modes, even for one PDF, because each page is its own file. `--dry-run` shows the base name (`report.png`), since the page count is only known once the PDF is read.
- **The password-protected test PDF is made with Apple's PDFKit.** No install-free library can encrypt PDFs, so `test/fixtures/make-fixtures.swift` writes `test/fixtures/locked.pdf`.
- **"Opens in common PDF readers" is checked with two PDF libraries.** The test suite has no PDF reader app, so konvertoj's PDFs are read back with `pdf-lib` and drawn with Mozilla's pdf.js (`pdftopng`), the engine behind Firefox's PDF viewer.
- **Exported page sizes are limited.** A page that would be over 16,384 pixels on a side, or over 268 million pixels, at the chosen DPI fails with advice to choose a lower `--dpi`, instead of running out of memory.
- **Earlier results in a folder are skipped, not failed.** Without `-o`, a PDF made from a folder, or the pages exported from one, are written into that folder. Running the same command again would then find them as inputs and fail. A file found through a folder or pattern that is already in the mode's output format, and that the mode can't use, is now skipped ("already a PNG"), or left out of a combined PDF with a note. Files named one by one still fail as before.

## 14. FFmpeg add-on

- **The download is pinned to `ffmpeg-static` release b6.1.1,** with the SHA-256 that GitHub publishes for each build stored in konvertoj. One build was downloaded during development, and its checksum matched. Windows on Arm has no build in that release, so it gets a message pointing to installing FFmpeg or `KONVERTOJ_FFMPEG_PATH`.
- **`--install-video` without a terminal downloads without asking.** Features.md says non-interactive runs never prompt or download, and tells such users to run `--install-video` first. That only works if `--install-video` itself downloads in a script or CI, so an explicit `--install-video` counts as the user's yes. Video modes in scripts still never download.
- **`--install-video` with an FFmpeg already installed downloads nothing.** konvertoj says which FFmpeg it will use. The add-on is only needed when there is no FFmpeg 5 or newer.
- **The prompt is on standard error, and Enter means yes.** That keeps standard output clean for scripts, and matches the `(Y/n)` in the question. Ctrl+C at the prompt or during the download stops with exit code `130` and saves nothing.
- **konvertoj searches the `PATH` itself.** On Windows, starting `ffmpeg` by name would also look in the current folder first, so an `ffmpeg.exe` sitting next to a user's videos could run. konvertoj only looks in the `PATH` folders.
- **Downloads are locked and resumable by retrying.** A lock file, refreshed every few seconds, stops two runs downloading at once. A lock from a run that was killed counts as stale after 30 seconds. A download that stalls for 30 seconds, stops part-way or doesn't match its checksum leaves nothing behind.
- **Tests use a local server and fake FFmpeg scripts.** The download source is a parameter, so tests serve a small gzipped file from `127.0.0.1` instead of downloading 20 to 30 MB. The fake FFmpeg is a shell script, which can't stand in for an executable on Windows (Node.js no longer runs `.cmd` files without a shell), so those tests are skipped there. The cache-folder, download-table and download tests still run on Windows.
- **The real MP4 in the first-time scenario comes with feature 15.** `movtomp4` gets its conversion in feature 15. Feature 14's tests check the same journey with a test-only mode that runs FFmpeg.

## 15. Video to MP4

- **A 0-byte video says "is empty".** Features.md expects "has no video" for a 0-byte file. konvertoj checks every input's contents before any mode runs (feature 5), and an empty file is reported as "is empty" for every mode, which is just as clear. A file with no video stream, or with a video stream that holds no frames, says "has no video".
- **Videos convert one at a time.** FFmpeg already uses every processor core, so running four at once would only compete for them and use more memory. The progress line shows the overall count and the current video's percentage.
- **`--resolution` limits the shorter side.** `720p` means the shorter side is at most 720 pixels, so a portrait phone video becomes 720 × 1280 rather than 405 × 720. Videos are never enlarged.
- **Odd sizes are trimmed to even ones.** H.264 needs even widths and heights, and FFmpeg 6 refuses odd ones, so a 321 × 181 screen recording becomes 320 × 180.
- **The first video and audio streams are kept,** with AAC audio at 160 kb/s. Extra audio tracks, subtitles and chapters are left out.
- **CI makes FFmpeg available with `--install-video`.** Before the tests, CI runs `konvertoj --install-video`. Where a runner has no FFmpeg, this downloads and verifies the real add-on. Video tests are skipped wherever no FFmpeg can be found.
- **The main video stream is the one converted.** Cover pictures (attached pictures, or still-image codecs such as MJPEG and PNG) stored as an extra video stream are skipped, and the stream marked as the default is preferred, so a cover image never replaces the video.
- **`--strip-metadata` works for video.** It removes the file's details, including any GPS location, and its chapters. Without it, the video's details are kept, as for images.

## 16. Audio from video

- **OGG uses Opus when FFmpeg has no Vorbis encoder.** Some FFmpeg builds, such as Homebrew's, have no Vorbis encoder. OGG files are then written with Opus, which every player that opens OGG also plays.
- **WAV and FLAC are 16-bit.** Both hold exactly the same samples, so either can be used as a lossless copy of the sound.
- **The first audio track is extracted.** Extra tracks (other languages, commentary) are left out.
- **`--start` and `--end` are checked for `togif` too.** They are the same options, and Features.md says `togif`'s times work "as in feature 16".
- **`--end 0` on its own is rejected.** A missing `--start` counts as the start of the video, so `--end` must come after it. Otherwise konvertoj would write an empty file and report it as converted.
- **Audio files are recognised, but not converted.** MP3, WAV, FLAC, M4A and OGG files are now detected, so earlier results found in a folder are skipped as "already an MP3", and an audio file given directly gets a clear message: konvertoj extracts audio from videos, but doesn't convert between audio formats (out of scope in Spec.md).
- **Warnings come from the mode registry.** Modes can declare warnings about their options, printed once before any file is processed. WAV and FLAC use this to say that `--bitrate` is ignored.
- **Opus is capped at 256k.** When OGG uses Opus, the highest bitrate it accepts for a one-channel recording is 256k, so `--bitrate 320k` is saved at 256k with a note, instead of failing on recorded talks.
- **Files already in the output format get their names last.** In a folder with `b.webm` and `b.mp3`, `tomp3` names the real conversion `b (1).mp3`. The existing `b.mp3`, which will be skipped, is planned after it, so it no longer pushes the new file to `b (2).mp3`.

## 17. GIF (`togif`)

- **The 30-second limit is on the chosen section, before `--speed`.** A 40-second clip with `--start 0:05 --end 0:30` is 25 seconds and is accepted. `--speed` doesn't count towards the limit, so the rule is the same whatever the speed, and the message can point at `--start` and `--end`.
- **`--width` also resizes image GIFs, and never enlarges.** Features.md describes `--width` for videos only. Ignoring it for images would silently do nothing, so it resizes them down too. A width larger than the image keeps the image's size, with a note, because `togif` never makes images bigger.
- **A GIF given only video options is skipped as already a GIF.** Running `togif` again on a folder with `--fps` finds the GIFs it made earlier. They are skipped like any file already in the output format, rather than failing because `--fps` only applies to videos. A PNG given `--fps` still fails with a clear message.
- **FFmpeg is needed only when an input is a video.** `togif` takes images and videos. The mode registry can now say a mode needs FFmpeg depending on its inputs, so making a GIF from images never asks to download the video add-on.
- **The "isn't available yet" rule is kept for future modes.** `togif` was the last mode without a conversion, so the tests for that message now use a test-only mode.

## 18. Cross-platform packaging

- **The install-size budget is 150 MB.** It is the total size of the files in `node_modules` after a clean install of the packed release. On macOS Apple Silicon this is 112.5 MB. sharp and @napi-rs/canvas install different binaries on each system, so the budget leaves room for them. Each system's figure is printed by the `package` CI job; this work wasn't pushed, so the first CI run will confirm them.
- **Proxy support uses Node.js's own.** The add-on download calls `http.setGlobalProxyFromEnv` (Node.js 24.14 and newer) with the run's `HTTPS_PROXY`, `HTTP_PROXY` and `NO_PROXY` settings, and restores the previous setting afterwards. Older Node.js 22 versions can't switch this on while running, so if the download can't connect and a proxy is set, the message says to set `NODE_USE_ENV_PROXY=1` (Node.js 22.21 and newer) or update Node.js. A proxy setting that isn't an address, such as `proxy.corp:8080`, is named in a plain-English error instead of a technical one. Nothing extra is installed.
- **`NO_PROXY` needs both download hosts.** The GitHub release address redirects to `release-assets.githubusercontent.com`, so excluding the download from the proxy needs both `github.com` and that host.
- **The start-up limit is checked on the installed copy.** The smoke test times five runs of `--help` after a warm-up and fails if the median is 500 ms or more. On macOS it is about 40 ms.
- **The smoke test hides any FFmpeg on the runner.** Its video steps run with a `PATH` holding only Node.js and an empty home folder, and they download the add-on through a local proxy, so every system checks the real download, the proxy route and the first video conversion. `NODE_USE_ENV_PROXY=1` is set only where Node.js lacks runtime proxy support, so Node.js 24 and newer check konvertoj's own proxy code.
- **Runners.** `windows-latest`, `macos-15-intel`, `macos-latest` (Apple Silicon), `ubuntu-latest` and `ubuntu-24.04-arm`, each with Node.js 22, 24 and the latest version: fifteen jobs that don't cancel each other. Their steps use `bash` (Git Bash on Windows), so they read the same everywhere.
- **The video steps of the smoke test weren't run locally.** Running the downloaded FFmpeg wasn't allowed in this environment, so those steps were checked by CI's design and by the proxy tests in `test/ffmpeg.test.ts`. The image, PDF, GIF, info, `--help` timing and install-size steps were run against a clean install of the packed release.
- **The proxy tests also run in the packaging job.** The `check` job uses Node.js 22, where the runtime proxy tests are skipped, so the `package` job runs `test/ffmpeg.test.ts` on Node.js 24 and the latest version too.

## 19. Documentation

- **The common options table is generated.** `npm run docs` builds the README's common options from the same definitions and wording as `--help`, so the two can't disagree, and the existing out-of-date check covers it. Each mode's own options are left to `konvertoj -m <mode> --help`, which the README points to.
- **The demo GIF appears once it is recorded.** `docs/demo.tape` and `npm run demo` record it with vhs, and a CI job records it from the script and checks it shows real output (`1 converted, 0 failed`). vhs isn't installed on the computer this was built on, and installing and running downloaded recording tools wasn't allowed here, so `docs/demo.gif` hasn't been recorded yet. `npm run docs` adds the image to the top of the README only when the file exists, so the README never shows a broken image. **Still to do before release (feature 20):** run `npm run demo` (or take the GIF from the CI job's artifact), commit `docs/demo.gif`, and run `npm run docs`.
- **Every example runs, not only the README's.** The examples test runs every `konvertoj` command in the README's tables and `bash` blocks, and every example of every mode (they all appear in `--help`): about 250 commands, through `main`, on generated files named as each command expects. Videos are made a few seconds longer than the command's `--start`. Video examples are skipped only where no FFmpeg can be found; CI installs it.
- **`bash` blocks hold only runnable examples.** Command shapes, `--install-video`, `--list-modes` and `--help` go in `text` blocks or prose, so the examples test can treat every `bash` line as a real command and fail on placeholders.
- **Web links are only checked online in CI.** The test suite checks file and heading links offline; `scripts/check-links.js` also fetches every web link in CI's Linux job, so a site being briefly down doesn't fail local tests. The README links only to pages that exist now; npm, repository and badge links come with publishing (feature 20). Relative links such as `CONTRIBUTING.md` only work on npmjs.com once `package.json` has a `repository` field, also for feature 20.
- **The demo job and the online link check haven't run in CI yet,** because this work hasn't been pushed. The link check was run locally and every link works.
- **The demo compresses a PNG.** The iPhone fixture is small, and its JPG is already optimised, so `compress` would show a skip. The demo converts it to PNG and compresses that instead.
- **PDF examples name the PDF file.** `topdf ./receipts -o receipts` named the input folder itself, so the PDF was saved inside it as `1.pdf`. The examples now use `-o receipts.pdf` and `-o scans.pdf`, which make the file the README describes. How konvertoj treats an existing folder given to `-o` is unchanged.
