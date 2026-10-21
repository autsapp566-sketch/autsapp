import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Vercel/Lambda: read-only except `/tmp` (`VERCEL` is not always set at import time). */
export function isServerlessRuntime() {
  if (process.env.VERCEL === '1' || process.env.VERCEL === 'true') return true;
  if (process.env.VERCEL_ENV) return true;
  if (process.env.AWS_LAMBDA_FUNCTION_NAME) return true;
  try {
    return process.cwd().startsWith('/var/task');
  } catch {
    return false;
  }
}

export function getProductUploadDir() {
  const localDir = path.join(__dirname, '../../uploads/products');
  if (isServerlessRuntime() || localDir.startsWith('/var/task')) {
    return '/tmp/uploads/products';
  }
  return localDir;
}
