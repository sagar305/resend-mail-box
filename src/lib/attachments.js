import { formatBytes } from './format.js';

/**
 * Used until `GET /api/mail/limits` answers, and if it never does. These mirror
 * the backend's defaults — the server is the authority and re-checks everything
 * on send, so being briefly out of date here only affects when the user is told.
 */
export const DEFAULT_LIMITS = {
  maxCount: 10,
  maxFileBytes: 10 * 1024 * 1024,
  maxTotalBytes: 20 * 1024 * 1024,
  blockedExtensions: [
    'ade', 'adp', 'apk', 'appx', 'appxbundle', 'bat', 'cab', 'chm', 'cmd', 'com', 'cpl',
    'diagcab', 'diagcfg', 'diagpack', 'dll', 'dmg', 'ex', 'ex_', 'exe', 'gadget', 'hta',
    'img', 'ins', 'iso', 'isp', 'jar', 'jnlp', 'js', 'jse', 'lib', 'lnk', 'mde', 'msc',
    'msi', 'msix', 'msixbundle', 'msp', 'mst', 'nsh', 'pif', 'ps1', 'scr', 'sct', 'shb',
    'sys', 'vb', 'vbe', 'vbs', 'vhd', 'vxd', 'wsc', 'wsf', 'wsh', 'xll',
  ],
};

export function extensionOf(filename) {
  const match = /\.([^.]+)$/.exec(String(filename ?? ''));
  return match ? match[1].toLowerCase() : '';
}

export function totalBytes(attachments) {
  return attachments.reduce((sum, attachment) => sum + attachment.size, 0);
}

let nextId = 0;

/**
 * Checks a freshly picked FileList against `limits` and what is already attached.
 * Returns the files worth keeping plus a message per rejection, so the user finds
 * out about an oversized file immediately rather than after a slow upload.
 */
export function checkFiles(files, existing, limits) {
  const accepted = [];
  const errors = [];
  let running = totalBytes(existing);

  for (const file of files) {
    const duplicate = [...existing, ...accepted].some(
      (attachment) => attachment.name === file.name && attachment.size === file.size,
    );
    if (duplicate) {
      errors.push(`"${file.name}" is already attached`);
      continue;
    }

    const extension = extensionOf(file.name);
    if (limits.blockedExtensions.includes(extension)) {
      errors.push(`.${extension} files are blocked by most mail providers, so "${file.name}" can't be sent`);
      continue;
    }
    if (file.size === 0) {
      errors.push(`"${file.name}" is empty`);
      continue;
    }
    if (file.size > limits.maxFileBytes) {
      errors.push(
        `"${file.name}" is ${formatBytes(file.size)}. The limit is ${formatBytes(limits.maxFileBytes)} per file.`,
      );
      continue;
    }
    if (existing.length + accepted.length >= limits.maxCount) {
      errors.push(`You can attach ${limits.maxCount} files at most, so "${file.name}" was skipped`);
      continue;
    }
    if (running + file.size > limits.maxTotalBytes) {
      errors.push(
        `Adding "${file.name}" would go over ${formatBytes(limits.maxTotalBytes)} of attachments in one email`,
      );
      continue;
    }

    running += file.size;
    accepted.push({ id: `att-${nextId++}`, name: file.name, size: file.size, type: file.type, file });
  }

  return { accepted, errors };
}

/**
 * Reads a file into the base64 string the API expects. FileReader gives us a
 * `data:…;base64,` URL, and everything after the comma is the payload.
 */
export function readAsAttachment({ name, type, file }) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`Could not read "${name}"`));
    reader.onload = () => {
      const result = String(reader.result);
      resolve({
        filename: name,
        contentType: type || 'application/octet-stream',
        content: result.slice(result.indexOf(',') + 1),
      });
    };
    reader.readAsDataURL(file);
  });
}
