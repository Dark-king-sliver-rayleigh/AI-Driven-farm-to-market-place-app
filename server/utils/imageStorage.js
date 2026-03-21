const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');

const UPLOAD_ROOT = path.join(__dirname, '..', 'uploads');
const DATA_URL_PATTERN = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/;

const MIME_EXTENSION_MAP = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg'
};

function getPublicBaseUrl(req) {
  return process.env.PUBLIC_SERVER_URL || `${req.protocol}://${req.get('host')}`;
}

function getExtension(mimeType) {
  return MIME_EXTENSION_MAP[mimeType] || 'bin';
}

function buildPublicUrl(req, entity, fileName) {
  return `${getPublicBaseUrl(req)}/uploads/${entity}/${fileName}`;
}

async function ensureUploadDir(entity) {
  const targetDir = path.join(UPLOAD_ROOT, entity);
  await fs.mkdir(targetDir, { recursive: true });
  return targetDir;
}

async function persistImage(image, { entity = 'products', req }) {
  if (typeof image !== 'string' || !image.trim()) {
    throw new Error('Image must be a non-empty string');
  }

  if (/^https?:\/\//i.test(image)) {
    return image;
  }

  if (image.startsWith('/uploads/')) {
    return `${getPublicBaseUrl(req)}${image}`;
  }

  const match = image.match(DATA_URL_PATTERN);
  if (!match) {
    throw new Error('Unsupported image format. Use a data URL or absolute URL.');
  }

  const [, mimeType, base64Payload] = match;
  const extension = getExtension(mimeType);
  const fileName = `${Date.now()}-${crypto.randomUUID()}.${extension}`;
  const targetDir = await ensureUploadDir(entity);
  const filePath = path.join(targetDir, fileName);

  await fs.writeFile(filePath, Buffer.from(base64Payload, 'base64'));
  return buildPublicUrl(req, entity, fileName);
}

async function persistImageList(images, options) {
  if (!Array.isArray(images) || images.length === 0) {
    return [];
  }

  const persistedImages = [];
  for (const image of images) {
    persistedImages.push(await persistImage(image, options));
  }

  return persistedImages;
}

module.exports = {
  persistImage,
  persistImageList
};
