/**
 * Fresh camera capture.
 *
 * The anti-fraud model rests on this file: attendance proof comes from a
 * live MediaStream only. There is no `<input type="file">` anywhere in the
 * attendance flow, so a gallery image cannot be submitted through the UI.
 *
 * This does NOT make spoofing impossible — a virtual camera can still feed
 * a stream, as MDN notes. It raises the cost, and pairs with the other
 * signals rather than standing alone.
 */

export type CameraFailure =
  | "unsupported"
  | "permission_denied"
  | "no_camera"
  | "in_use";

export class CameraError extends Error {
  constructor(readonly kind: CameraFailure) {
    super(kind);
    this.name = "CameraError";
  }
}

export const CAMERA_ERROR_MESSAGES: Record<CameraFailure, string> = {
  unsupported: "Aapka browser camera support nahi karta.",
  permission_denied:
    "Camera permission chahiye. Browser settings me ise allow karein.",
  no_camera: "Koi camera nahi mila.",
  in_use: "Camera kisi aur app me chal raha hai. Use band karke try karein.",
};

export function getCameraErrorMessage(error: unknown): string {
  if (error instanceof CameraError) return CAMERA_ERROR_MESSAGES[error.kind];
  return CAMERA_ERROR_MESSAGES.unsupported;
}

export type FacingMode = "user" | "environment";

export async function openCamera(
  facingMode: FacingMode = "user",
): Promise<MediaStream> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    throw new CameraError("unsupported");
  }

  try {
    return await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode,
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
      audio: false,
    });
  } catch (error) {
    const name = (error as DOMException)?.name;

    if (name === "NotAllowedError" || name === "SecurityError") {
      throw new CameraError("permission_denied");
    }
    if (name === "NotFoundError" || name === "OverconstrainedError") {
      throw new CameraError("no_camera");
    }
    if (name === "NotReadableError") {
      throw new CameraError("in_use");
    }
    throw new CameraError("unsupported");
  }
}

export function stopCamera(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}

/**
 * Grabs the current frame and compresses it.
 *
 * WebP at 720px wide lands around 40-80KB, which keeps a year of daily
 * check-ins comfortably inside a free storage tier.
 */
export async function captureFrame(
  video: HTMLVideoElement,
  maxWidth = 720,
): Promise<Blob> {
  const scale = Math.min(1, maxWidth / (video.videoWidth || maxWidth));
  const width = Math.round((video.videoWidth || maxWidth) * scale);
  const height = Math.round((video.videoHeight || maxWidth) * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) throw new CameraError("unsupported");

  context.drawImage(video, 0, 0, width, height);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/webp", 0.82),
  );

  if (!blob) throw new CameraError("unsupported");
  return blob;
}
