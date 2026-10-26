import CoreGraphics
import Foundation
import ImageIO
import PDFKit
import UniformTypeIdentifiers

let folder = URL(fileURLWithPath: CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : ".")

func quadrants(width: Int, height: Int) -> CGImage {
    let context = CGContext(
        data: nil, width: width, height: height, bitsPerComponent: 8, bytesPerRow: 0,
        space: CGColorSpace(name: CGColorSpace.sRGB)!,
        bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)!
    let halfWidth = width / 2
    let halfHeight = height / 2
    let colours: [(Int, Int, CGFloat, CGFloat, CGFloat)] = [
        (0, halfHeight, 1, 0, 0),
        (halfWidth, halfHeight, 0, 1, 0),
        (0, 0, 0, 0, 1),
        (halfWidth, 0, 1, 1, 0),
    ]
    for (x, y, red, green, blue) in colours {
        context.setFillColor(red: red, green: green, blue: blue, alpha: 1)
        context.fill(CGRect(x: x, y: y, width: halfWidth, height: halfHeight))
    }
    return context.makeImage()!
}

let cameraDetails: [CFString: Any] = [
    kCGImagePropertyOrientation: 6,
    kCGImagePropertyTIFFDictionary: [
        kCGImagePropertyTIFFMake: "Apple",
        kCGImagePropertyTIFFOrientation: 6,
        kCGImagePropertyTIFFModel: "iPhone 15 Pro",
    ],
    kCGImagePropertyExifDictionary: [
        kCGImagePropertyExifDateTimeOriginal: "2026:07:14 10:30:00",
        kCGImagePropertyExifLensModel: "iPhone 15 Pro back camera",
    ],
    kCGImagePropertyGPSDictionary: [
        kCGImagePropertyGPSLatitude: 51.5007,
        kCGImagePropertyGPSLatitudeRef: "N",
        kCGImagePropertyGPSLongitude: 0.1246,
        kCGImagePropertyGPSLongitudeRef: "W",
    ],
]

func write(_ name: String, images: [(CGImage, [CFString: Any])]) {
    let url = folder.appendingPathComponent(name) as CFURL
    let destination = CGImageDestinationCreateWithURL(
        url, UTType.heic.identifier as CFString, images.count, nil)!
    for (image, properties) in images {
        CGImageDestinationAddImage(destination, image, properties as CFDictionary)
    }
    guard CGImageDestinationFinalize(destination) else {
        fatalError("Couldn't write \(name)")
    }
}

write("iphone.heic", images: [(quadrants(width: 64, height: 48), cameraDetails)])
write(
    "burst.heic",
    images: [
        (quadrants(width: 80, height: 40), [:]),
        (quadrants(width: 32, height: 32), [:]),
    ])

func writeLockedPdf(_ name: String) {
    let data = NSMutableData()
    var page = CGRect(x: 0, y: 0, width: 200, height: 100)
    let consumer = CGDataConsumer(data: data as CFMutableData)!
    let context = CGContext(consumer: consumer, mediaBox: &page, nil)!
    context.beginPDFPage(nil)
    context.setFillColor(red: 1, green: 0, blue: 0, alpha: 1)
    context.fill(CGRect(x: 20, y: 20, width: 60, height: 40))
    context.endPDFPage()
    context.closePDF()
    let document = PDFDocument(data: data as Data)!
    document.write(
        to: folder.appendingPathComponent(name),
        withOptions: [.userPasswordOption: "secret", .ownerPasswordOption: "owner"])
}

writeLockedPdf("locked.pdf")
