/**
 * Image uploads.
 *
 * Storage must be enabled in the Firebase Console (see README). If it isn't,
 * the SDK throws `storage/unknown` — we translate that into an actionable
 * message instead of a broken button.
 */
import { deleteObject, getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import { storage } from '../firebase/firebase.js';
import { AppError } from '../utils/errors.js';

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB
export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];

/** Validate a File before spending bandwidth on it. */
export function validateImageFile(file) {
  if (!file) return 'Choose an image.';
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    return 'Use a JPG, PNG, WebP, GIF or AVIF image.';
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return `That image is ${(file.size / 1024 / 1024).toFixed(1)} MB — the limit is 5 MB.`;
  }
  return '';
}

/** Read intrinsic dimensions (used for stable layout while images load). */
export function readImageDimensions(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      resolve({ width: 0, height: 0 });
      URL.revokeObjectURL(url);
    };
    img.src = url;
  });
}

function extensionFor(file) {
  const fromName = file.name?.split('.').pop()?.toLowerCase();
  if (fromName && fromName.length <= 5) return fromName;
  const map = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/avif': 'avif' };
  return map[file.type] || 'img';
}

/**
 * Resumable upload with progress callbacks.
 * `onProgress(0..1)` keeps the sending bubble informed.
 */
export async function uploadChatImage({ file, conversationId, uid, onProgress, signal }) {
  const error = validateImageFile(file);
  if (error) throw new AppError('image-validation', error);
  if (!conversationId || !uid) throw new AppError('invalid-argument', 'Missing upload context.');

  const objectPath = `chat-images/${conversationId}/${uid}/${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}.${extensionFor(file)}`;
  try {
    const storageRef = ref(storage, objectPath);
    const task = uploadBytesResumable(storageRef, file, {
      contentType: file.type,
      cacheControl: 'public,max-age=31536000',
      customMetadata: { uploaderUid: uid, conversationId },
    });

    const unsubscribe = signal?.addEventListener?.('abort', () => task.cancel());
    const snapshot = await new Promise((resolve, reject) => {
      task.on(
        'state_changed',
        (event) => {
          const ratio = event.totalBytes ? event.bytesTransferred / event.totalBytes : 0;
          onProgress?.(ratio);
        },
        (failure) => {
          unsubscribe?.();
          reject(failure);
        },
        () => {
          unsubscribe?.();
          resolve(task.snapshot);
        },
      );
    });

    const url = await getDownloadURL(snapshot.ref);
    const dimensions = await readImageDimensions(file);
    return {
      url,
      storagePath: objectPath,
      bytes: file.size,
      width: dimensions.width,
      height: dimensions.height,
    };
  } catch (uploadError) {
    if (uploadError?.code === 'storage/canceled') throw new AppError('upload-cancelled', 'Upload cancelled.');
    if (uploadError?.code === 'storage/retry-limit-exceeded') {
      throw new AppError('upload-failed', 'The upload failed — check your connection and try again.');
    }
    throw new AppError(
      'storage/unknown',
      'Image upload is unavailable. Enable Cloud Storage in Firebase Console, then try again.',
    );
  }
}

/** Upload an avatar; returns the public download URL. */
export async function uploadAvatar({ file, uid, onProgress }) {
  const error = validateImageFile(file);
  if (error) throw new AppError('image-validation', error);
  const objectPath = `avatars/${uid}/${Date.now()}.${extensionFor(file)}`;
  try {
    const storageRef = ref(storage, objectPath);
    const task = uploadBytesResumable(storageRef, file, { contentType: file.type });
    const snapshot = await new Promise((resolve, reject) => {
      task.on(
        'state_changed',
        (event) => onProgress?.(event.totalBytes ? event.bytesTransferred / event.totalBytes : 0),
        reject,
        () => resolve(task.snapshot),
      );
    });
    const url = await getDownloadURL(snapshot.ref);
    return { url, storagePath: objectPath };
  } catch {
    throw new AppError(
      'storage/unknown',
      'Avatar upload is unavailable. Enable Cloud Storage in Firebase Console, then try again.',
    );
  }
}

export async function removeStoredImage(storagePath) {
  if (!storagePath) return;
  try {
    await deleteObject(ref(storage, storagePath));
  } catch (error) {
    if (!import.meta.env.PROD) console.warn('[chazter] could not delete object', error?.code);
  }
}
