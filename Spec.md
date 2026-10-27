# konvertoj — Spec

**Package:** [`konvertoj`](https://www.npmjs.com/package/konvertoj) on npm
**Stage:** Released (v1.0.0 on npm)

---

## 1. Introduction

konvertoj is a command-line tool for converting and editing images, PDFs and a few common video and audio files. It works like FreeConvert's tools, but runs entirely on your own computer. Nothing is uploaded, there are no accounts, no file-size limits and no watermarks.

Like [repomix](https://repomix.com), it needs no setup. Typing `npx konvertoj` runs it straight away, and anyone who uses it often can install it as a permanent command.

```
konvertoj -m heictojpg holiday.heic -o beach
```

This turns `holiday.heic` into `beach.jpg` in the same folder.

---

## 2. Goals and quality bar

These are what "done" means for v1.

- **Private:** files never leave the computer, and no internet connection is needed once it's installed.
- **Zero setup:** `npx konvertoj` works on a clean Windows, macOS or Linux machine with only Node.js installed, with nothing else to download or configure. Video and audio are the one exception (see 5.7): they need a one-time add-on, which konvertoj offers to download the first time it's needed.
- **Simple by default:** the common case needs only a mode and a file. Every other option is optional and has a sensible default.
- **Safe:** originals are never changed or deleted, existing files are never overwritten unless asked, and photo details such as camera and location are kept unless the user asks for them to be removed.
- **Fast:** a typical phone photo converts in under a second. Longer jobs such as video show live progress and an estimated time left.
- **Helpful:** errors explain what went wrong and how to fix it in plain English, e.g. *"holiday.heic looks like a PNG. Try: -m pngtojpg"* or *"Unknown mode heic2jpg. Did you mean heictojpg?"*
- **Scriptable:** clean output and reliable success and failure signals, so it can be used inside scripts and automated workflows.
- **Documented:** a README with a copy-paste example for every mode, and built-in help for every mode.
- **Portfolio-ready:** published on npm, with a demo of the tool in action and a short write-up.

---

## 3. Who it's for

| User | What they want |
|---|---|
| **Developers** | Quick format changes and smaller images for websites. |
| **Everyday users** | Turn iPhone photos (HEIC) and videos (MOV) into files that work everywhere. |
| **Content creators** | Resize and compress images in bulk, pull audio from recordings and make GIFs from short clips. |
| **Automators** | Run conversions inside scripts with predictable results. |

---

## 4. How it's used

```
konvertoj -m <mode> <input> -o <output> [options]
```

| Part | Short | Long | Meaning |
|---|---|---|---|
| Mode | `-m` | `--mode` | What to do, e.g. `heictojpg`, `resize`, `compress` |
| Input | | | One file, several files, a folder or a pattern such as `*.heic` |
| Output | `-o` | `--output` | Name of the new file (the extension is added automatically), or a folder for batches. If left out, the output keeps the input's name with the new extension. |
| Options | | | Settings for the chosen mode, e.g. `--quality 80` or `--width 1200` |

- **Modes** are named `<from>to<to>`, e.g. `heictojpg`, `pngtowebp`, `movtomp4`. There is one spelling per mode. A shorter `to<format>` form, e.g. `tojpg`, works out the input format automatically.
- Running `konvertoj` on its own shows the help screen. `konvertoj --list-modes` lists every mode, and `konvertoj -m <mode> --help` explains one mode.

---

## 5. Features

### 5.1 Image conversion

Convert between JPG, PNG, WebP, AVIF, GIF, TIFF, BMP and ICO. iPhone photos (HEIC) and SVG files can be converted into any of these. Common options cover quality, size and background colour.

### 5.2 Image tools

- **Compress:** make files smaller, by quality level or to a target size, with a before-and-after size summary.
- **Resize:** by width, height or percentage, keeping the shape.
- **Crop:** to exact dimensions, a position or an aspect ratio such as 16:9, or trim plain borders.
- **Rotate and flip:** including fixing sideways phone photos automatically.
- **Enlarge:** upscale to 2x or 4x.
- **Colour picker:** get the colour at a point or an image's main colours.
- **Info:** show an image's format, size, dimensions and details.
- **Strip:** remove camera and location details before sharing.

### 5.3 PDF

- Turn one or many images into a single PDF.
- Turn PDF pages into images.

### 5.4 GIF

- `togif` turns an image or a short video clip into a GIF, with options for size, speed and start and end time.

### 5.5 Video and audio

- Convert MOV and other common video files (MKV, AVI, WebM, M4V) to MP4.
- Extract audio from video as MP3, WAV, M4A, OGG or FLAC, optionally trimming to a section.

### 5.6 Batch processing

Every mode works on many files, whole folders (optionally including subfolders) or patterns. A progress bar shows the count, one failed file doesn't stop the rest, and a summary at the end lists successes, failures and space saved.

### 5.7 Video and audio add-on

Video, audio and video-to-GIF conversions use FFmpeg, a widely used video tool. To keep konvertoj small for everyone else, FFmpeg isn't part of the main download.

- **FFmpeg already installed:** konvertoj finds it and uses it, so there's nothing to download.
- **FFmpeg not installed:** the first time a video or audio mode is used, konvertoj asks before downloading a one-time add-on. It's saved on the computer and reused after that, including with `npx`.
- **Offline or declined:** konvertoj explains how to get the add-on later or install FFmpeg yourself. Image and PDF modes keep working as normal.

---

## 6. Out of scope

- Online, cloud or account features
- An interactive or guided menu
- Making GIFs from a series of separate images, collage making and turning images into vector SVGs
- Video editing (filters, overlays, joining clips) and audio-to-audio conversion
- Document conversion (Word, Excel, eBooks)
- A graphical app or website
