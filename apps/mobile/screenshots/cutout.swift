// Lifts the subject out of a photo into a transparent PNG, for the face in the YouTube
// thumbnail (see compose-devpost.mjs, THUMB_FACE).
//
// It is macOS's own Vision framework, so there is nothing to install and no photo leaves the
// machine. A cut-out, rather than the frame as shot, because the room behind the subject (a
// wall, a chair with its logo, a window) is noise at thumbnail size.
//
// Keep the OUTPUT out of the repo: it is a photo of a person, not an app asset.
//
//   swift screenshots/cutout.swift <photo> <out.png>           # every subject Vision finds
//   swift screenshots/cutout.swift <photo> <out.png> 1         # only subject 1
//   swift screenshots/cutout.swift <photo> <out.png> person    # PEOPLE only
//
// Two different Vision requests, because they disagree about what a "subject" is:
//
//  - The default is subject lifting (the request behind "Copy Subject" in Photos). It finds
//    the salient FOREGROUND, so an office chair touching someone's shoulders comes out as
//    part of them — and on a photo whose background has already been removed, everything
//    left is foreground, chair included.
//  - `person` is person segmentation, which masks human bodies and nothing else. That is the
//    one that drops the chair. Its edge on hair is a little softer, which at thumbnail size
//    does not show.

import CoreImage
import Foundation
import Vision

let args = CommandLine.arguments
guard args.count >= 3 else {
  print("usage: swift cutout.swift <photo> <out.png> [instance | person]")
  exit(1)
}
let source = URL(fileURLWithPath: args[1])
let destination = URL(fileURLWithPath: args[2])
let mode = args.count > 3 ? args[3] : nil

guard let image = CIImage(contentsOf: source) else { fatalError("could not load \(source.path)") }
let handler = VNImageRequestHandler(ciImage: image)

func write(_ output: CIImage) throws {
  try CIContext().writePNGRepresentation(
    of: output, to: destination, format: .RGBA8,
    colorSpace: CGColorSpace(name: CGColorSpace.sRGB)!)
  print("wrote", destination.path, Int(output.extent.width), "x", Int(output.extent.height))
}

if mode == "person" {
  let request = VNGeneratePersonSegmentationRequest()
  request.qualityLevel = .accurate
  request.outputPixelFormat = kCVPixelFormatType_OneComponent8
  try handler.perform([request])
  guard let maskBuffer = request.results?.first?.pixelBuffer else { fatalError("no person found") }

  // The mask comes back smaller than the photo; stretch it over the photo before blending.
  var mask = CIImage(cvPixelBuffer: maskBuffer)
  mask = mask.transformed(
    by: CGAffineTransform(
      scaleX: image.extent.width / mask.extent.width,
      y: image.extent.height / mask.extent.height))

  // Pull the edge in a few pixels, then soften it. A photo whose background was already
  // removed (or shot against a pale wall) leaves a light fringe along the hair, which reads
  // as a white outline once the cut-out sits on a dark ground; eroding the mask trims it and
  // removes stray specks at the same time. The blur keeps the new edge from looking cut out
  // with scissors.
  mask = mask
    .applyingFilter("CIMorphologyMinimum", parameters: [kCIInputRadiusKey: 4])
    .applyingFilter("CIGaussianBlur", parameters: [kCIInputRadiusKey: 1.5])
    .cropped(to: image.extent)

  let clear = CIImage(color: .clear).cropped(to: image.extent)
  try write(
    image.applyingFilter(
      "CIBlendWithMask",
      parameters: [kCIInputBackgroundImageKey: clear, kCIInputMaskImageKey: mask]))
} else {
  let request = VNGenerateForegroundInstanceMaskRequest()
  try handler.perform([request])
  guard let result = request.results?.first else { fatalError("no subject found") }

  print("instances found:", Array(result.allInstances))
  let instances: IndexSet = mode.flatMap(Int.init).map { IndexSet(integer: $0) } ?? result.allInstances
  let masked = try result.generateMaskedImage(
    ofInstances: instances, from: handler, croppedToInstancesExtent: true)
  try write(CIImage(cvPixelBuffer: masked))
}
