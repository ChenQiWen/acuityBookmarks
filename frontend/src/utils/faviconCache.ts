// Shared favicon cache keyed by hostname
const hostnameToFaviconUrl = new Map<string, string>();

export function getFaviconUrlForHostname(hostname: string): string {
  const cached = hostnameToFaviconUrl.get(hostname);
  if (cached) return cached;
  const faviconUrl = `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`;
  hostnameToFaviconUrl.set(hostname, faviconUrl);
  return faviconUrl;
}

export function getFaviconUrlForUrl(url?: string): string {
  if (!url) return '';
  try {
    const hostname = new URL(url).hostname;
    return getFaviconUrlForHostname(hostname);
  } catch {
    return '';
  }
}

export function hasFaviconForUrl(url?: string): boolean {
  if (!url) return false;
  try {
    const hostname = new URL(url).hostname;
    return hostnameToFaviconUrl.has(hostname);
  } catch {
    return false;
  }
}

export function clearFaviconCache(): void {
  hostnameToFaviconUrl.clear();
}

export { hostnameToFaviconUrl as faviconCacheMap };


