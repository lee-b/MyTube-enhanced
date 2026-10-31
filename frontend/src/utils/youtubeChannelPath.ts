/**
 * Convert a persisted YouTube channel URL into the youtube.com-relative
 * channel path the /api/youtube/channel listing endpoint expects
 * ("channel/UC...", "c/<name>" or "@<handle>", matching the redirect
 * controller's normalization). Returns null for anything that is not a
 * recognizable YouTube channel URL — including the /user/... form, which the
 * backend does not serve.
 */
export function channelUrlToChannelPath(url?: string | null): string | null {
    if (!url) return null;

    let parsed: URL;
    try {
        parsed = new URL(url, 'https://www.youtube.com');
    } catch {
        return null;
    }
    if (!/(^|\.)youtube\.com$/.test(parsed.hostname)) return null;

    const segments = parsed.pathname.split('/').filter(Boolean);
    if (segments.length === 0) return null;

    // Strip a trailing tab segment (/videos, /streams, ...) so the backend's
    // listing URL, which appends /videos itself, does not double it up.
    const knownTabs = ['videos', 'streams', 'shorts', 'live', 'featured', 'playlists', 'community'];
    let path = parsed.pathname.replace(/\/+$/, '');
    if (knownTabs.includes(segments[segments.length - 1].toLowerCase())) {
        path = path.slice(0, path.length - segments[segments.length - 1].length - 1).replace(/\/+$/, '');
    }

    const inner = path.slice(1); // drop the leading slash
    if (!inner) return null;

    const firstSegment = inner.split('/')[0];
    const isChannelLike =
        firstSegment.startsWith('@') ||
        firstSegment === 'channel' ||
        firstSegment === 'c';
    if (!isChannelLike) return null;

    return inner;
}
