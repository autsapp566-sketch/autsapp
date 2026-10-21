const MAX_IMAGES = 6;

const IMAGE_TAG_RE = /\[\s*IMAGE\s*:\s*(https?:\/\/[^\]\s]+)\s*\]/gi;
const BARE_IMAGE_URL_RE =
  /https?:\/\/(?:images\.unsplash\.com\/[^\s)\]]+|[^\s)\]]+(?:\/api\/uploads\/images\/[A-Za-z0-9-]+|\.(?:png|jpe?g|webp|gif)(?:\?[^\s)\]]*)?))/gi;

/**
 * Pulls image links out of a bot reply so they can be sent as real WhatsApp images
 * instead of raw URLs in the text.
 *
 * @param {string} text
 * @returns {{ text: string, imageUrls: string[] }}
 */
export function extractImagesFromBotText(text) {
  const source = typeof text === 'string' ? text : '';
  const found = [];

  let cleaned = source.replace(IMAGE_TAG_RE, (_m, url) => {
    found.push(url);
    return '';
  });

  cleaned = cleaned.replace(BARE_IMAGE_URL_RE, (url) => {
    found.push(url);
    return '';
  });

  // Leftover empty tags / bullets / separators and extra blank lines.
  cleaned = cleaned
    .replace(/\[\s*IMAGE\s*:?\s*\]/gi, '')
    .replace(/^[\s\-–•|،,:]+$/gm, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  const imageUrls = [...new Set(found.map((u) => u.replace(/[.,;!؟،]+$/, '')))].slice(0, MAX_IMAGES);
  return { text: cleaned, imageUrls };
}

/**
 * @param {string} url
 */
export function fileNameForImageUrl(url) {
  const match = /\.(png|jpe?g|webp|gif)(?:\?|$)/i.exec(url);
  return match ? `image.${match[1].toLowerCase().replace('jpeg', 'jpg')}` : 'image.jpg';
}
