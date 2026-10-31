import { Avatar, Box, Checkbox, FormControlLabel, Stack, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import ChannelSubscribeButton from './ChannelSubscribeButton';
import ExternalSearchSection from './ExternalSearchSection';
import { useDownload } from '../contexts/DownloadContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useVideo } from '../contexts/VideoContext';
import { authorAvatarFallbackSx } from '../utils/authorAvatarStyles';
import { formatViewCount } from '../utils/formatUtils';
import { VideoSearchResult } from '../types';

const CHANNEL_PAGE_SIZE = 24;

/** Channel identity the listing endpoint derives from the flat playlist
 * response, so the page can present a real name and blurb instead of the
 * raw "channel/UC..." path it was reached through. Exported so surfaces that
 * host the listing (author pages) can render the profile themselves. */
export interface YouTubeChannelInfo {
    id?: string;
    name?: string;
    url?: string;
    subscriberCount?: number;
    description?: string;
    thumbnailUrl?: string;
}

interface YouTubeChannelListingProps {
    /** youtube.com-relative channel path, e.g. "channel/UC...", "c/<name>"
        or "@<handle>" — the form the /api/youtube/channel endpoint takes. */
    channelPath: string;
    /** Optional section heading. When omitted, the component renders the
        channel's name (from the listing, falling back to the path) as an h1,
        like the standalone local channel page does. */
    heading?: string;
    /** When set, the channel header (avatar, name, subscriber count, blurb,
        subscribe button) is not rendered here; the host surface renders it
        itself, typically above its own content. */
    hideChannelHeader?: boolean;
    /** Reports the channel identity the listing endpoint derived, so host
        surfaces can render the profile details without re-fetching. */
    onChannelInfo?: (info: YouTubeChannelInfo | undefined) => void;
}

/**
 * A YouTube channel's recent uploads, listed via yt-dlp through the
 * /api/youtube/channel endpoint and rendered with the same external search
 * cards the search page uses. Shared by the standalone local channel page
 * (redirector takeover target) and the author pages' "all past videos"
 * listing, so both surfaces page, download, and delete identically.
 *
 * The channel header (avatar, name, subscriber count, blurb, subscribe
 * button) and the downloaded-only filter live here too, so both surfaces
 * present the channel the same way.
 *
 * View routes through the video takeover target (local player or on-demand
 * download), Download queues a background download, and locally-downloaded
 * videos offer Delete.
 */
const YouTubeChannelListing: React.FC<YouTubeChannelListingProps> = ({
    channelPath,
    heading,
    hideChannelHeader,
    onChannelInfo,
}) => {
    const { t } = useLanguage();
    const theme = useTheme();
    const { handleVideoSubmit } = useDownload();
    const { deleteVideo } = useVideo();

    const [downloadedOnly, setDownloadedOnly] = useState(false);
    const [channelInfo, setChannelInfo] = useState<YouTubeChannelInfo | undefined>();
    const [avatarFailed, setAvatarFailed] = useState(false);
    const [downloadingIds, setDownloadingIds] = useState<ReadonlySet<string>>(() => new Set());
    const [results, setResults] = useState<VideoSearchResult[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState(false);
    const [exhausted, setExhausted] = useState(false);
    // The backend pages with 1-based playlist offsets, so the next page starts
    // after everything already shown.
    const nextOffsetRef = useRef(1);

    const fetchPage = async (offset: number, append: boolean) => {
        try {
            const response = await fetch(
                `/api/youtube/channel/${encodeURIComponent(channelPath)}?offset=${offset}`
            );
            if (!response.ok) {
                throw new Error(`status ${response.status}`);
            }
            const data = (await response.json()) as { results?: VideoSearchResult[]; channel?: YouTubeChannelInfo };
            const page = data.results ?? [];
            nextOffsetRef.current = offset + page.length;
            setExhausted(page.length < CHANNEL_PAGE_SIZE);
            setResults((prev) => (append ? [...prev, ...page] : page));
            // A fresh (non-appended) page resets the channel identity too, so
            // navigating to another channel never shows the previous one.
            setChannelInfo(data.channel);
            setAvatarFailed(false);
            setError(false);
        } catch {
            setError(true);
            setExhausted(true);
        }
    };

    useEffect(() => {
        onChannelInfo?.(channelInfo);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [channelInfo]);

    useEffect(() => {
        // Initial listing; runs once per channel thanks to the key. Inlined
        // (rather than through fetchPage) so nothing in the effect body
        // touches state synchronously.
        let cancelled = false;
        (async () => {
            try {
                const response = await fetch(
                    `/api/youtube/channel/${encodeURIComponent(channelPath)}?offset=1`
                );
                if (!response.ok) {
                    throw new Error(`status ${response.status}`);
                }
                const data = (await response.json()) as { results?: VideoSearchResult[]; channel?: YouTubeChannelInfo };
                const page = data.results ?? [];
                if (cancelled) return;
                nextOffsetRef.current = 1 + page.length;
                setExhausted(page.length < CHANNEL_PAGE_SIZE);
                setResults(page);
                setChannelInfo(data.channel);
                setAvatarFailed(false);
                setError(false);
            } catch {
                if (cancelled) return;
                setError(true);
                setExhausted(true);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [channelPath]);

    const handleLoadMore = async () => {
        if (loadingMore || loading || exhausted) return;
        setLoadingMore(true);
        await fetchPage(nextOffsetRef.current, true);
        setLoadingMore(false);
    };

    const handleDownload = async (result: VideoSearchResult) => {
        try {
            setDownloadingIds((prev) => {
                if (prev.has(result.id)) return prev;
                const next = new Set(prev);
                next.add(result.id);
                return next;
            });
            // No related event and no special source kind: browsing a channel
            // page is a plain manual download from the statistics' point of
            // view.
            await handleVideoSubmit(result.sourceUrl, false, { surface: 'web' });
        } catch (error) {
            console.error('Error downloading from channel page:', error);
        } finally {
            setDownloadingIds((prev) => {
                const next = new Set(prev);
                next.delete(result.id);
                return next;
            });
        }
    };

    const handleDelete = (result: VideoSearchResult) => {
        if (!result.localVideoId) return;
        void deleteVideo(result.localVideoId).then((response) => {
            if (response.success) {
                setResults((prev) => prev.filter((entry) => entry.id !== result.id));
            }
        });
    };

    // Prefer the playlist's channel identity, then the entries' uploader
    // names, then the prettified tail of the path that reached this page.
    const channelName = useMemo(() => {
        if (channelInfo?.name) return channelInfo.name;
        const author = results.find((entry) => entry.author)?.author;
        if (author) return author;
        const tail = channelPath.split('/').pop() ?? channelPath;
        return decodeURIComponent(tail).replace(/^@/, '');
    }, [channelInfo, results, channelPath]);

    const channelUrl = `https://www.youtube.com/${channelPath}`;

    const subscribeButton = loading || error ? null : (
        <ChannelSubscribeButton channelUrl={channelUrl} channelName={channelName} trustedName={channelInfo?.name} />
    );

    const channelHeader = !loading && !error && (
        <Stack direction="row" spacing={2} alignItems="flex-start" sx={{ mb: 3 }}>
            {channelInfo?.thumbnailUrl && !avatarFailed ? (
                <Box
                    component="img"
                    src={channelInfo.thumbnailUrl}
                    alt={channelName}
                    referrerPolicy="no-referrer"
                    onError={() => setAvatarFailed(true)}
                    sx={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover' }}
                />
            ) : (
                <Avatar sx={{ ...authorAvatarFallbackSx(theme), width: 64, height: 64, fontSize: 28 }}>
                    {channelName.charAt(0).toUpperCase()}
                </Avatar>
            )}
            <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="h5" component={heading === undefined ? 'h1' : 'h2'} fontWeight="bold" noWrap>
                    {channelName}
                </Typography>
                {channelInfo?.subscriberCount !== undefined && (
                    <Typography variant="body2" color="text.secondary">
                        {`${formatViewCount(channelInfo.subscriberCount)} ${t('channelSubscribers')}`}
                    </Typography>
                )}
                {channelInfo?.description && (
                    <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ mt: 1, whiteSpace: 'pre-line' }}
                    >
                        {channelInfo.description}
                    </Typography>
                )}
            </Box>
            <Box sx={{ flexShrink: 0 }}>{subscribeButton}</Box>
        </Stack>
    );

    // Downloaded filter: the listing is the channel's full catalogue, so the
    // downloaded view is just the subset the library already holds.
    const visibleResults = downloadedOnly
        ? results.filter((entry) => entry.local === true)
        : results;

    const filterToggle = !loading && results.length > 0 && (
        <FormControlLabel
            control={
                <Checkbox
                    size="small"
                    checked={downloadedOnly}
                    onChange={(event) => setDownloadedOnly(event.target.checked)}
                />
            }
            label={t('channelFilterDownloaded')}
            sx={{ mb: 2 }}
        />
    );

    const listing = (
        <ExternalSearchSection
            source="youtube"
            heading={heading ?? t('youtubeChannelUploads')}
            loadingLabel={t('loadingYouTubeResults')}
            emptyLabel={downloadedOnly ? t('noDownloadedChannelVideos') : t('noYouTubeResults')}
            results={visibleResults}
            loading={loading}
            loadingMore={loadingMore && !exhausted}
            onLoadMore={exhausted ? () => undefined : handleLoadMore}
            onDownload={handleDownload}
            onDelete={handleDelete}
            downloadingIds={downloadingIds}
        />
    );

    // The channel page keeps youtube.com as its documented fallback; the
    // author pages just hide the section when the listing will not load.
    const errorText = error && (
        <Typography color="text.secondary" sx={{ mt: 2 }}>
            {t('youtubeChannelLoadFailed')}
        </Typography>
    );

    const listingWithFilter = (
        <>
            {filterToggle}
            {listing}
        </>
    );

    return (
        <>
            {hideChannelHeader ? null : channelHeader}
            {listingWithFilter}
            {errorText}
        </>
    );
};

export default YouTubeChannelListing;
