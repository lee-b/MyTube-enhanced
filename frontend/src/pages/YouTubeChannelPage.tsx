import { Container, Typography } from '@mui/material';
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router';
import ExternalSearchSection from '../components/ExternalSearchSection';
import { useDownload } from '../contexts/DownloadContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useVideo } from '../contexts/VideoContext';
import { VideoSearchResult } from '../types';

const CHANNEL_PAGE_SIZE = 24;

/**
 * Local page for a YouTube channel reached through the browser-redirector
 * takeover target (/from/youtube/channel/<path>) when the channel is not in
 * the library. The backend lists the channel's recent uploads via yt-dlp
 * (no download), and this page renders them with the same external search
 * cards the search page uses — View routes through the video takeover target
 * (local player or on-demand download), Download queues a background
 * download, and locally-downloaded videos offer Delete.
 *
 * The listing component is keyed by the channel path so navigating to another
 * channel remounts it with fresh state instead of resetting through an effect.
 */
const YouTubeChannelListing: React.FC<{ channelPath: string }> = ({ channelPath }) => {
    const { t } = useLanguage();
    const { handleVideoSubmit } = useDownload();
    const { deleteVideo } = useVideo();

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
            const data = (await response.json()) as { results?: VideoSearchResult[] };
            const page = data.results ?? [];
            nextOffsetRef.current = offset + page.length;
            setExhausted(page.length < CHANNEL_PAGE_SIZE);
            setResults((prev) => (append ? [...prev, ...page] : page));
            setError(false);
        } catch {
            setError(true);
            setExhausted(true);
        }
    };

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
                const data = (await response.json()) as { results?: VideoSearchResult[] };
                const page = data.results ?? [];
                if (cancelled) return;
                nextOffsetRef.current = 1 + page.length;
                setExhausted(page.length < CHANNEL_PAGE_SIZE);
                setResults(page);
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

    // Flat playlist entries carry the uploader name; fall back to the path
    // that reached this page.
    const channelName = results.find((entry) => entry.author)?.author || channelPath;

    return (
        <>
            <Typography variant="h4" component="h1" fontWeight="bold">
                {channelName}
            </Typography>
            <ExternalSearchSection
                source="youtube"
                heading={t('youtubeChannelUploads')}
                loadingLabel={t('loadingYouTubeResults')}
                emptyLabel={t('noYouTubeResults')}
                results={results}
                loading={loading}
                loadingMore={loadingMore && !exhausted}
                onLoadMore={exhausted ? () => undefined : handleLoadMore}
                onDownload={handleDownload}
                onDelete={handleDelete}
                downloadingIds={downloadingIds}
            />
            {error && (
                <Typography color="text.secondary" sx={{ mt: 2 }}>
                    {t('youtubeChannelLoadFailed')}
                </Typography>
            )}
        </>
    );
};

const YouTubeChannelPage: React.FC = () => {
    const { encodedPath } = useParams<{ encodedPath: string }>();

    const channelPath = encodedPath ?? '';

    return (
        <Container maxWidth="xl" sx={{ py: 4 }}>
            <YouTubeChannelListing key={channelPath} channelPath={channelPath} />
        </Container>
    );
};

export default YouTubeChannelPage;
