/** Browsers send Sec-Fetch-Site on every fetch; anything but same-origin/none is a cross-site request. */
export function isSameOriginRequest(req: Request): boolean {
  const site = req.headers.get('sec-fetch-site');
  return site === null || site === 'same-origin' || site === 'none';
}
