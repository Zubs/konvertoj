# video-add-on Specification

## Purpose
Defines how konvertoj gets FFmpeg for video and audio work without bundling it: using an installed copy, or a one-time, checksum-verified download the user agrees to, saved for later runs, and never a download without asking.

## Requirements

### Requirement: Finding FFmpeg
When a mode that needs FFmpeg runs, konvertoj SHALL use, in order: the FFmpeg at `KONVERTOJ_FFMPEG_PATH` when that is set; FFmpeg on the `PATH` when it is version 5 or newer; or the copy konvertoj downloaded before. An installed FFmpeg older than version 5 SHALL be ignored. A `KONVERTOJ_FFMPEG_PATH` that isn't a working FFmpeg SHALL fail, naming the path.

#### Scenario: Installed FFmpeg
- **WHEN** FFmpeg 6 is on the `PATH`
- **THEN** it is used, and nothing is downloaded

#### Scenario: Old FFmpeg
- **WHEN** only FFmpeg 4 is on the `PATH`, and no copy was downloaded before
- **THEN** it is ignored, and the download is offered

#### Scenario: Chosen FFmpeg
- **WHEN** `KONVERTOJ_FFMPEG_PATH` points at a working FFmpeg and another is on the `PATH`
- **THEN** the one at `KONVERTOJ_FFMPEG_PATH` is used

### Requirement: Cache folder
The downloaded FFmpeg SHALL be kept in `%LOCALAPPDATA%\konvertoj` on Windows, `~/Library/Caches/konvertoj` on macOS, and `$XDG_CACHE_HOME/konvertoj` on Linux when `XDG_CACHE_HOME` is set, or `~/.cache/konvertoj` otherwise, and SHALL be reused by every later run.

#### Scenario: Each system
- **WHEN** the cache folder is worked out for Windows, macOS and Linux, and for Linux with `XDG_CACHE_HOME` set
- **THEN** each is the folder above

#### Scenario: Second run
- **WHEN** a mode needing FFmpeg runs after the add-on was downloaded
- **THEN** the saved copy is used, without a prompt or a download

### Requirement: Asking before downloading
When no FFmpeg is found and the run is interactive, konvertoj SHALL ask once, before any file is processed, showing the exact download size for the computer's system and processor, and SHALL download only if the user agrees. Pressing Enter SHALL mean yes.

#### Scenario: Accepting
- **WHEN** the user answers `y` or presses Enter
- **THEN** the add-on is downloaded, verified and saved, and the work continues

#### Scenario: Declining
- **WHEN** the user answers `n`
- **THEN** the mode fails with exit code `1`, explaining both routes: run `konvertoj --install-video` later, or install FFmpeg yourself

#### Scenario: Exact size
- **WHEN** the prompt is shown on Apple Silicon macOS
- **THEN** it gives the size of the macOS arm64 download, 18 MB

### Requirement: Never download without asking
A non-interactive run SHALL NOT prompt or download. A mode needing FFmpeg SHALL then fail, telling the user to run `konvertoj --install-video` first or to install FFmpeg.

#### Scenario: Script or CI
- **WHEN** a mode needing FFmpeg runs with no terminal and no FFmpeg available
- **THEN** it fails with exit code `1`, mentions `--install-video`, and nothing is downloaded

### Requirement: Verified, safe download
The download SHALL come from the pinned release URL for the system and processor. It SHALL be checked against the SHA-256 checksum stored in konvertoj before it is used, and saved so that a failure never leaves a partial or unverified copy behind. Two runs at the same time SHALL NOT both download or corrupt the saved copy.

#### Scenario: Wrong checksum
- **WHEN** the downloaded file doesn't match its checksum
- **THEN** it is deleted, and the run fails saying the download didn't match

#### Scenario: Failure part-way
- **WHEN** the download stops part-way
- **THEN** nothing is left in the cache folder, and the next run offers the download again

#### Scenario: Two runs at once
- **WHEN** two installs run at the same time
- **THEN** the file is downloaded once, and both end with the same working copy

#### Scenario: Offline
- **WHEN** there is no internet connection
- **THEN** the failure says the download couldn't connect and explains both routes, and image modes still work

### Requirement: Installing in advance
`konvertoj --install-video` SHALL download the add-on in advance, after the same prompt in an interactive run, and without a prompt in a non-interactive run, because the user asked for it. When a usable FFmpeg is already available, it SHALL say so and download nothing.

#### Scenario: Already there
- **WHEN** `--install-video` runs after the add-on was downloaded
- **THEN** it says the add-on is already installed, with its path, downloads nothing, and exits with `0`

### Requirement: Running FFmpeg safely
FFmpeg SHALL be run as a separate process with its arguments passed as a list, never through a shell, and its progress SHALL be reported as a share of the input's duration.

#### Scenario: Awkward names
- **WHEN** FFmpeg is run on a file named `my "holiday" clip $(echo hi).mov`
- **THEN** FFmpeg receives that exact name as one argument

#### Scenario: Progress
- **WHEN** FFmpeg reports it has processed 5 seconds of a 10-second input
- **THEN** the progress given to the reporter is 0.5

### Requirement: First-time video user
A first-time user SHALL get from `npx konvertoj -m movtomp4 clip.mov` to an MP4 by accepting one download.

#### Scenario: First run
- **WHEN** a user with no FFmpeg runs a video mode in a terminal and accepts the download
- **THEN** the add-on is saved and the conversion goes ahead with it

### Requirement: Downloading behind a proxy
The add-on download SHALL use the standard `HTTPS_PROXY`, `HTTP_PROXY` and `NO_PROXY` settings (in either upper or lower case) when they are set, through Node.js's built-in proxy support.

#### Scenario: Behind a proxy
- **WHEN** `HTTPS_PROXY` (or `HTTP_PROXY` for an `http` address) points to a proxy and the add-on is downloaded
- **THEN** the download goes through the proxy and the add-on is installed

#### Scenario: HTTPS download through HTTPS_PROXY
- **WHEN** `HTTPS_PROXY` is set and the download address starts with `https`
- **THEN** konvertoj connects to the proxy and asks it for a tunnel to the download host on port 443

#### Scenario: Excluded by NO_PROXY
- **WHEN** the download address is listed in `NO_PROXY`
- **THEN** the download connects directly

#### Scenario: No proxy settings
- **WHEN** no proxy setting is set
- **THEN** the download connects directly, as before

### Requirement: Proxy problems explained
A proxy setting that isn't a valid address SHALL fail with a plain-English message naming the setting and showing the expected form. On a Node.js version without runtime proxy support, a failed connection with a proxy setting SHALL say how to use the proxy: set `NODE_USE_ENV_PROXY=1` (Node.js 22.21 or newer) or update Node.js.

#### Scenario: Invalid proxy setting
- **WHEN** `HTTPS_PROXY` is set to `proxy.corp:8080`, which has no `http://`
- **THEN** the run fails saying `HTTPS_PROXY` isn't a valid proxy address, that it should look like `http://proxy.example.com:8080`, and to fix or unset it, with no stack trace

#### Scenario: Older Node.js with a proxy setting
- **WHEN** Node.js has no runtime proxy support, `NODE_USE_ENV_PROXY` isn't set, a proxy setting is set and the download can't connect
- **THEN** the connection message adds that konvertoj found a proxy setting and says to set `NODE_USE_ENV_PROXY=1` (Node.js 22.21 or newer) or update Node.js
