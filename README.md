# konvertoj

A local, private command-line tool for converting and editing images, PDFs and a few common video and audio files. Everything runs on your own computer, and nothing is uploaded.

konvertoj is in development. Full documentation will arrive with the first release.

## Modes

<!-- modes:start -->
### Image

| Mode | What it does | Example |
| --- | --- | --- |
| `jpgtopng` | Convert JPG to PNG | `konvertoj -m jpgtopng photo.jpg` |
| `jpgtowebp` | Convert JPG to WebP | `konvertoj -m jpgtowebp photo.jpg` |
| `jpgtoavif` | Convert JPG to AVIF | `konvertoj -m jpgtoavif photo.jpg` |
| `jpgtogif` | Convert JPG to GIF | `konvertoj -m jpgtogif photo.jpg` |
| `jpgtotiff` | Convert JPG to TIFF | `konvertoj -m jpgtotiff photo.jpg` |
| `jpgtobmp` | Convert JPG to BMP | `konvertoj -m jpgtobmp photo.jpg` |
| `jpgtoico` | Convert JPG to ICO (icon) | `konvertoj -m jpgtoico photo.jpg` |
| `pngtojpg` | Convert PNG to JPG | `konvertoj -m pngtojpg image.png` |
| `pngtowebp` | Convert PNG to WebP | `konvertoj -m pngtowebp image.png` |
| `pngtoavif` | Convert PNG to AVIF | `konvertoj -m pngtoavif image.png` |
| `pngtogif` | Convert PNG to GIF | `konvertoj -m pngtogif image.png` |
| `pngtotiff` | Convert PNG to TIFF | `konvertoj -m pngtotiff image.png` |
| `pngtobmp` | Convert PNG to BMP | `konvertoj -m pngtobmp image.png` |
| `pngtoico` | Convert PNG to ICO (icon) | `konvertoj -m pngtoico image.png` |
| `webptojpg` | Convert WebP to JPG | `konvertoj -m webptojpg image.webp` |
| `webptopng` | Convert WebP to PNG | `konvertoj -m webptopng image.webp` |
| `webptoavif` | Convert WebP to AVIF | `konvertoj -m webptoavif image.webp` |
| `webptogif` | Convert WebP to GIF | `konvertoj -m webptogif image.webp` |
| `webptotiff` | Convert WebP to TIFF | `konvertoj -m webptotiff image.webp` |
| `webptobmp` | Convert WebP to BMP | `konvertoj -m webptobmp image.webp` |
| `webptoico` | Convert WebP to ICO (icon) | `konvertoj -m webptoico image.webp` |
| `aviftojpg` | Convert AVIF to JPG | `konvertoj -m aviftojpg image.avif` |
| `aviftopng` | Convert AVIF to PNG | `konvertoj -m aviftopng image.avif` |
| `aviftowebp` | Convert AVIF to WebP | `konvertoj -m aviftowebp image.avif` |
| `aviftogif` | Convert AVIF to GIF | `konvertoj -m aviftogif image.avif` |
| `aviftotiff` | Convert AVIF to TIFF | `konvertoj -m aviftotiff image.avif` |
| `aviftobmp` | Convert AVIF to BMP | `konvertoj -m aviftobmp image.avif` |
| `aviftoico` | Convert AVIF to ICO (icon) | `konvertoj -m aviftoico image.avif` |
| `giftojpg` | Convert GIF to JPG | `konvertoj -m giftojpg animation.gif` |
| `giftopng` | Convert GIF to PNG | `konvertoj -m giftopng animation.gif` |
| `giftowebp` | Convert GIF to WebP | `konvertoj -m giftowebp animation.gif` |
| `giftoavif` | Convert GIF to AVIF | `konvertoj -m giftoavif animation.gif` |
| `giftotiff` | Convert GIF to TIFF | `konvertoj -m giftotiff animation.gif` |
| `giftobmp` | Convert GIF to BMP | `konvertoj -m giftobmp animation.gif` |
| `giftoico` | Convert GIF to ICO (icon) | `konvertoj -m giftoico animation.gif` |
| `tifftojpg` | Convert TIFF to JPG | `konvertoj -m tifftojpg scan.tiff` |
| `tifftopng` | Convert TIFF to PNG | `konvertoj -m tifftopng scan.tiff` |
| `tifftowebp` | Convert TIFF to WebP | `konvertoj -m tifftowebp scan.tiff` |
| `tifftoavif` | Convert TIFF to AVIF | `konvertoj -m tifftoavif scan.tiff` |
| `tifftogif` | Convert TIFF to GIF | `konvertoj -m tifftogif scan.tiff` |
| `tifftobmp` | Convert TIFF to BMP | `konvertoj -m tifftobmp scan.tiff` |
| `tifftoico` | Convert TIFF to ICO (icon) | `konvertoj -m tifftoico scan.tiff` |
| `bmptojpg` | Convert BMP to JPG | `konvertoj -m bmptojpg image.bmp` |
| `bmptopng` | Convert BMP to PNG | `konvertoj -m bmptopng image.bmp` |
| `bmptowebp` | Convert BMP to WebP | `konvertoj -m bmptowebp image.bmp` |
| `bmptoavif` | Convert BMP to AVIF | `konvertoj -m bmptoavif image.bmp` |
| `bmptogif` | Convert BMP to GIF | `konvertoj -m bmptogif image.bmp` |
| `bmptotiff` | Convert BMP to TIFF | `konvertoj -m bmptotiff image.bmp` |
| `bmptoico` | Convert BMP to ICO (icon) | `konvertoj -m bmptoico image.bmp` |
| `icotojpg` | Convert ICO (icon) to JPG | `konvertoj -m icotojpg favicon.ico` |
| `icotopng` | Convert ICO (icon) to PNG | `konvertoj -m icotopng favicon.ico` |
| `icotowebp` | Convert ICO (icon) to WebP | `konvertoj -m icotowebp favicon.ico` |
| `icotoavif` | Convert ICO (icon) to AVIF | `konvertoj -m icotoavif favicon.ico` |
| `icotogif` | Convert ICO (icon) to GIF | `konvertoj -m icotogif favicon.ico` |
| `icototiff` | Convert ICO (icon) to TIFF | `konvertoj -m icototiff favicon.ico` |
| `icotobmp` | Convert ICO (icon) to BMP | `konvertoj -m icotobmp favicon.ico` |
| `heictojpg` | Convert HEIC (iPhone photo) to JPG | `konvertoj -m heictojpg holiday.heic` |
| `heictopng` | Convert HEIC (iPhone photo) to PNG | `konvertoj -m heictopng holiday.heic` |
| `heictowebp` | Convert HEIC (iPhone photo) to WebP | `konvertoj -m heictowebp holiday.heic` |
| `heictoavif` | Convert HEIC (iPhone photo) to AVIF | `konvertoj -m heictoavif holiday.heic` |
| `heictogif` | Convert HEIC (iPhone photo) to GIF | `konvertoj -m heictogif holiday.heic` |
| `heictotiff` | Convert HEIC (iPhone photo) to TIFF | `konvertoj -m heictotiff holiday.heic` |
| `heictobmp` | Convert HEIC (iPhone photo) to BMP | `konvertoj -m heictobmp holiday.heic` |
| `heictoico` | Convert HEIC (iPhone photo) to ICO (icon) | `konvertoj -m heictoico holiday.heic` |
| `svgtojpg` | Convert SVG to JPG | `konvertoj -m svgtojpg logo.svg` |
| `svgtopng` | Convert SVG to PNG | `konvertoj -m svgtopng logo.svg` |
| `svgtowebp` | Convert SVG to WebP | `konvertoj -m svgtowebp logo.svg` |
| `svgtoavif` | Convert SVG to AVIF | `konvertoj -m svgtoavif logo.svg` |
| `svgtogif` | Convert SVG to GIF | `konvertoj -m svgtogif logo.svg` |
| `svgtotiff` | Convert SVG to TIFF | `konvertoj -m svgtotiff logo.svg` |
| `svgtobmp` | Convert SVG to BMP | `konvertoj -m svgtobmp logo.svg` |
| `svgtoico` | Convert SVG to ICO (icon) | `konvertoj -m svgtoico logo.svg` |
| `tojpg` | Convert any image to JPG | `konvertoj -m tojpg ./downloads -o ./jpgs` |
| `topng` | Convert any image to PNG | `konvertoj -m topng ./downloads -o ./pngs` |
| `towebp` | Convert any image to WebP | `konvertoj -m towebp ./downloads -o ./webps` |
| `toavif` | Convert any image to AVIF | `konvertoj -m toavif ./downloads -o ./avifs` |
| `totiff` | Convert any image to TIFF | `konvertoj -m totiff ./downloads -o ./tiffs` |
| `tobmp` | Convert any image to BMP | `konvertoj -m tobmp ./downloads -o ./bmps` |
| `toico` | Convert any image to ICO (icon) | `konvertoj -m toico ./downloads -o ./icos` |

### PDF

| Mode | What it does | Example |
| --- | --- | --- |
| `jpgtopdf` | Turn JPG images into one PDF | `konvertoj -m jpgtopdf ./scans -o scans` |
| `pngtopdf` | Turn PNG images into one PDF | `konvertoj -m pngtopdf ./scans -o scans` |
| `webptopdf` | Turn WebP images into one PDF | `konvertoj -m webptopdf ./scans -o scans` |
| `aviftopdf` | Turn AVIF images into one PDF | `konvertoj -m aviftopdf ./scans -o scans` |
| `giftopdf` | Turn GIF images into one PDF | `konvertoj -m giftopdf ./scans -o scans` |
| `tifftopdf` | Turn TIFF images into one PDF | `konvertoj -m tifftopdf ./scans -o scans` |
| `bmptopdf` | Turn BMP images into one PDF | `konvertoj -m bmptopdf ./scans -o scans` |
| `icotopdf` | Turn ICO (icon) images into one PDF | `konvertoj -m icotopdf ./scans -o scans` |
| `heictopdf` | Turn HEIC (iPhone photo) images into one PDF | `konvertoj -m heictopdf ./scans -o scans` |
| `svgtopdf` | Turn SVG images into one PDF | `konvertoj -m svgtopdf ./scans -o scans` |
| `topdf` | Turn any image files into one PDF | `konvertoj -m topdf ./receipts -o receipts` |
| `pdftojpg` | Export PDF pages as JPG images | `konvertoj -m pdftojpg report.pdf -o pages` |
| `pdftopng` | Export PDF pages as PNG images | `konvertoj -m pdftopng report.pdf -o pages` |
| `pdftowebp` | Export PDF pages as WebP images | `konvertoj -m pdftowebp report.pdf -o pages` |
| `pdftoavif` | Export PDF pages as AVIF images | `konvertoj -m pdftoavif report.pdf -o pages` |
| `pdftogif` | Export PDF pages as GIF images | `konvertoj -m pdftogif report.pdf -o pages` |
| `pdftotiff` | Export PDF pages as TIFF images | `konvertoj -m pdftotiff report.pdf -o pages` |
| `pdftobmp` | Export PDF pages as BMP images | `konvertoj -m pdftobmp report.pdf -o pages` |
| `pdftoico` | Export PDF pages as ICO (icon) images | `konvertoj -m pdftoico report.pdf -o pages` |

### GIF

| Mode | What it does | Example |
| --- | --- | --- |
| `togif` | Turn an image or a short video clip into a GIF | `konvertoj -m togif clip.mp4 --start 0:02 --end 0:05` |

### Video & Audio

| Mode | What it does | Example |
| --- | --- | --- |
| `movtomp4` | Convert MOV video to MP4 | `konvertoj -m movtomp4 clip.mov` |
| `mkvtomp4` | Convert MKV video to MP4 | `konvertoj -m mkvtomp4 video.mkv` |
| `avitomp4` | Convert AVI video to MP4 | `konvertoj -m avitomp4 video.avi` |
| `webmtomp4` | Convert WebM video to MP4 | `konvertoj -m webmtomp4 video.webm` |
| `m4vtomp4` | Convert M4V video to MP4 | `konvertoj -m m4vtomp4 video.m4v` |
| `tomp4` | Convert any supported video to MP4 | `konvertoj -m tomp4 ./videos -o ./mp4s` |
| `movtomp3` | Extract the audio from MOV video as MP3 | `konvertoj -m movtomp3 clip.mov` |
| `movtowav` | Extract the audio from MOV video as WAV | `konvertoj -m movtowav clip.mov` |
| `movtom4a` | Extract the audio from MOV video as M4A | `konvertoj -m movtom4a clip.mov` |
| `movtoogg` | Extract the audio from MOV video as OGG | `konvertoj -m movtoogg clip.mov` |
| `movtoflac` | Extract the audio from MOV video as FLAC | `konvertoj -m movtoflac clip.mov` |
| `mkvtomp3` | Extract the audio from MKV video as MP3 | `konvertoj -m mkvtomp3 video.mkv` |
| `mkvtowav` | Extract the audio from MKV video as WAV | `konvertoj -m mkvtowav video.mkv` |
| `mkvtom4a` | Extract the audio from MKV video as M4A | `konvertoj -m mkvtom4a video.mkv` |
| `mkvtoogg` | Extract the audio from MKV video as OGG | `konvertoj -m mkvtoogg video.mkv` |
| `mkvtoflac` | Extract the audio from MKV video as FLAC | `konvertoj -m mkvtoflac video.mkv` |
| `avitomp3` | Extract the audio from AVI video as MP3 | `konvertoj -m avitomp3 video.avi` |
| `avitowav` | Extract the audio from AVI video as WAV | `konvertoj -m avitowav video.avi` |
| `avitom4a` | Extract the audio from AVI video as M4A | `konvertoj -m avitom4a video.avi` |
| `avitoogg` | Extract the audio from AVI video as OGG | `konvertoj -m avitoogg video.avi` |
| `avitoflac` | Extract the audio from AVI video as FLAC | `konvertoj -m avitoflac video.avi` |
| `webmtomp3` | Extract the audio from WebM video as MP3 | `konvertoj -m webmtomp3 video.webm` |
| `webmtowav` | Extract the audio from WebM video as WAV | `konvertoj -m webmtowav video.webm` |
| `webmtom4a` | Extract the audio from WebM video as M4A | `konvertoj -m webmtom4a video.webm` |
| `webmtoogg` | Extract the audio from WebM video as OGG | `konvertoj -m webmtoogg video.webm` |
| `webmtoflac` | Extract the audio from WebM video as FLAC | `konvertoj -m webmtoflac video.webm` |
| `m4vtomp3` | Extract the audio from M4V video as MP3 | `konvertoj -m m4vtomp3 video.m4v` |
| `m4vtowav` | Extract the audio from M4V video as WAV | `konvertoj -m m4vtowav video.m4v` |
| `m4vtom4a` | Extract the audio from M4V video as M4A | `konvertoj -m m4vtom4a video.m4v` |
| `m4vtoogg` | Extract the audio from M4V video as OGG | `konvertoj -m m4vtoogg video.m4v` |
| `m4vtoflac` | Extract the audio from M4V video as FLAC | `konvertoj -m m4vtoflac video.m4v` |
| `mp4tomp3` | Extract the audio from MP4 video as MP3 | `konvertoj -m mp4tomp3 video.mp4` |
| `mp4towav` | Extract the audio from MP4 video as WAV | `konvertoj -m mp4towav video.mp4` |
| `mp4tom4a` | Extract the audio from MP4 video as M4A | `konvertoj -m mp4tom4a video.mp4` |
| `mp4toogg` | Extract the audio from MP4 video as OGG | `konvertoj -m mp4toogg video.mp4` |
| `mp4toflac` | Extract the audio from MP4 video as FLAC | `konvertoj -m mp4toflac video.mp4` |
| `tomp3` | Extract the audio from any supported video as MP3 | `konvertoj -m tomp3 talk.mp4 --start 1:30 --end 45:00` |
| `towav` | Extract the audio from any supported video as WAV | `konvertoj -m towav talk.mp4 --start 1:30 --end 45:00` |
| `tom4a` | Extract the audio from any supported video as M4A | `konvertoj -m tom4a talk.mp4 --start 1:30 --end 45:00` |
| `toogg` | Extract the audio from any supported video as OGG | `konvertoj -m toogg talk.mp4 --start 1:30 --end 45:00` |
| `toflac` | Extract the audio from any supported video as FLAC | `konvertoj -m toflac talk.mp4 --start 1:30 --end 45:00` |

### Tools

| Mode | What it does | Example |
| --- | --- | --- |
| `compress` | Make images smaller while keeping them looking good | `konvertoj -m compress hero.jpg` |
| `resize` | Change an image's width and height | `konvertoj -m resize photo.jpg --width 1200` |
| `enlarge` | Upscale an image to 2x or 4x its size | `konvertoj -m enlarge icon.png` |
| `crop` | Cut an image to an area, a position or an aspect ratio, or trim plain borders | `konvertoj -m crop photo.jpg --width 800 --height 800` |
| `rotate` | Turn an image by any angle, or upright using its orientation tag | `konvertoj -m rotate scan.jpg --angle 180` |
| `flip` | Mirror an image horizontally or vertically | `konvertoj -m flip selfie.jpg --direction horizontal` |
| `strip` | Remove camera, date and location details from images | `konvertoj -m strip ./holiday -o ./to-share` |
| `info` | Show an image's format, size, dimensions and details | `konvertoj -m info photo.jpg` |
| `colorpick` | Report the colour at a point, or an image's main colours | `konvertoj -m colorpick logo.png --at 10,10` |
<!-- modes:end -->

## Licence

[MIT](LICENSE)
