export const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

export const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/ogg",
  "audio/m4a",
  "audio/aac",
  "audio/flac",
  "audio/x-m4a",
]);

export const ALLOWED_EXTENSIONS = new Set([
  "jpg", "jpeg", "png", "gif", "webp",
  "mp3", "wav", "ogg", "m4a", "aac", "flac",
]);

export type FileValidationError = { file: string; reason: string };

export function validateFile(file: File): FileValidationError | null {
  if (file.size > MAX_FILE_SIZE) {
    return { file: file.name, reason: `exceeds 20 MB limit (${(file.size / 1024 / 1024).toFixed(1)} MB)` };
  }
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!ALLOWED_EXTENSIONS.has(ext) && !ALLOWED_MIME_TYPES.has(file.type)) {
    return { file: file.name, reason: "file type not allowed" };
  }
  return null;
}

const MAX_IMAGE_DIM = 1920;
const JPEG_QUALITY = 0.85;

export async function resizeImageIfNeeded(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/gif") {
    // Don't process non-images or GIFs (would lose animation)
    return file;
  }

  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      const { naturalWidth: w, naturalHeight: h } = img;

      if (w <= MAX_IMAGE_DIM && h <= MAX_IMAGE_DIM) {
        // Already small enough — skip re-encoding
        resolve(file);
        return;
      }

      const scale = MAX_IMAGE_DIM / Math.max(w, h);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(w * scale);
      canvas.height = Math.round(h * scale);

      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve(file); return; }

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      canvas.toBlob(
        (blob) => {
          if (!blob) { resolve(file); return; }
          // Rename to .jpg since we always output JPEG
          const baseName = file.name.replace(/\.[^.]+$/, "");
          resolve(new File([blob], `${baseName}.jpg`, { type: "image/jpeg" }));
        },
        "image/jpeg",
        JPEG_QUALITY
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(file); // Fall back to original on decode error
    };

    img.src = objectUrl;
  });
}
