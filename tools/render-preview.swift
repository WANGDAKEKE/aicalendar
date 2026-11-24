import Foundation
import AVFoundation
import AppKit
import CoreVideo

let args = CommandLine.arguments
let inputImage = NSImage(contentsOfFile: args[1])!
var rect = NSRect(origin: .zero, size: inputImage.size)
let image = inputImage.cgImage(forProposedRect: &rect, context: nil, hints: nil)!
let output = URL(fileURLWithPath: args[2])
let writer = try AVAssetWriter(outputURL: output, fileType: .mp4)
let width = 960, height = 540, fps = 24, frames = 288
let track = AVAssetWriterInput(mediaType: .video, outputSettings: [AVVideoCodecKey: AVVideoCodecType.h264, AVVideoWidthKey: width, AVVideoHeightKey: height])
let adaptor = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: track, sourcePixelBufferAttributes: [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32ARGB, kCVPixelBufferWidthKey as String: width, kCVPixelBufferHeightKey as String: height, kCVPixelBufferCGImageCompatibilityKey as String: true, kCVPixelBufferCGBitmapContextCompatibilityKey as String: true])
writer.add(track)
guard writer.startWriting() else { print(writer.error?.localizedDescription ?? "Could not start encoder"); exit(1) }
writer.startSession(atSourceTime: .zero)
for frame in 0..<frames {
  while !track.isReadyForMoreMediaData { Thread.sleep(forTimeInterval: 0.005) }
  var buffer: CVPixelBuffer?
  CVPixelBufferCreate(nil, width, height, kCVPixelFormatType_32ARGB, [kCVPixelBufferCGImageCompatibilityKey: true, kCVPixelBufferCGBitmapContextCompatibilityKey: true] as CFDictionary, &buffer)
  CVPixelBufferLockBaseAddress(buffer!, [])
  let context = CGContext(data: CVPixelBufferGetBaseAddress(buffer!), width: width, height: height, bitsPerComponent: 8, bytesPerRow: CVPixelBufferGetBytesPerRow(buffer!), space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.noneSkipFirst.rawValue)!
  let phase = Double(frame) / Double(frames - 1)
  let zoom = 1.02 + 0.1 * sin(phase * Double.pi)
  let base = max(Double(width) / Double(image.width), Double(height) / Double(image.height))
  let w = Double(image.width) * base * zoom, h = Double(image.height) * base * zoom
  context.draw(image, in: CGRect(x: (Double(width)-w)/2 + sin(phase*Double.pi*2)*12, y: (Double(height)-h)/2, width: w, height: h))
  for p in 0..<28 {
    let x = (Double(p * 73) + phase * 170).truncatingRemainder(dividingBy: Double(width))
    let y = (Double(p * 97) + phase * 85).truncatingRemainder(dividingBy: Double(height))
    context.setFillColor(CGColor(red: 1, green: 0.82, blue: 0.5, alpha: 0.2 + 0.16*sin(phase*12+Double(p))))
    context.fillEllipse(in: CGRect(x: x, y: y, width: 3, height: 3))
  }
  CVPixelBufferUnlockBaseAddress(buffer!, [])
  adaptor.append(buffer!, withPresentationTime: CMTime(value: Int64(frame), timescale: Int32(fps)))
}
track.markAsFinished()
let semaphore = DispatchSemaphore(value: 0)
writer.finishWriting { semaphore.signal() }
semaphore.wait()
if writer.status != .completed { fatalError(writer.error?.localizedDescription ?? "Encoding failed") }
print("Created 12-second H.264 preview")
