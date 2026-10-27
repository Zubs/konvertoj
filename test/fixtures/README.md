# Test fixtures

Files the tests can't make for themselves.

- `iphone.heic`, `burst.heic` and `locked.pdf` are made on macOS by `make-fixtures.swift`, which uses Apple's own HEIC encoder and PDFKit:

  ```bash
  swift test/fixtures/make-fixtures.swift test/fixtures
  ```

- `clip.mov` is a 2-second iPhone-style video: HEVC (`hvc1`) at 320 × 180 with AAC audio, tagged as filmed upright (rotated 90°). It was made with FFmpeg:

  ```bash
  ffmpeg -f lavfi -i testsrc2=s=320x180:r=30 -f lavfi -i sine=f=440:sample_rate=48000 -t 2 \
    -c:v libx265 -tag:v hvc1 -c:a aac plain.mov
  ffmpeg -display_rotation 90 -i plain.mov -c copy test/fixtures/clip.mov
  ```
