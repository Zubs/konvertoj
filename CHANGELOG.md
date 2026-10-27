# Changelog

All notable changes to konvertoj are listed here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and konvertoj uses [Semantic Versioning](https://semver.org/).

## 1.0.0 - 2026-10-27

The first release.

### Added

- The `konvertoj -m <mode> <input> -o <output>` command, with `--help`, `--list-modes`, `--version` and suggestions for mistyped modes.
- Files, folders and patterns as inputs, with `-r` for subfolders, clear output names, and originals never touched or overwritten without `--overwrite`.
- Batches that keep going past failures, a progress line, a summary, `--dry-run`, `--quiet`, `--verbose`, and exit codes `0`, `1`, `2` and `130`.
- Format detection from file contents, so a mis-named file is recognised for what it really is.
- Conversion between JPG, PNG, WebP, AVIF, GIF, TIFF, BMP and ICO, and from HEIC and SVG, with quality, background and transparency handling.
- Keeping or removing camera, date and location details, with `strip` and `--strip-metadata`.
- `resize` and `enlarge`, `compress` (including `--target-size`), and `crop`, `rotate` and `flip`.
- `info` and `colorpick`.
- PDFs from images (`topdf`) and images from PDF pages.
- The optional video add-on: a one-time, verified FFmpeg download, asked about first, or an installed FFmpeg, with `--install-video`.
- Video to MP4, with `--resolution` and `--mute`.
- Audio from video as MP3, WAV, M4A, OGG or FLAC, with `--bitrate`, `--start` and `--end`.
- GIFs from videos and images with `togif`.
- Clean-install checks on Windows, macOS and Linux with Node.js 22, 24 and the latest version, an install-size budget, and proxy support for the add-on download.
- This README, generated mode and option tables, tested examples and links, a demo script, and this changelog and a contributing guide.
