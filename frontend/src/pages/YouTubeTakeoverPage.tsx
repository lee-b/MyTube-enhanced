import { Box, Button, CircularProgress, Typography } from '@mui/material';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useLanguage } from '../contexts/LanguageContext';
import {
  YOUTUBE_TAKEOVER_POLL_INTERVAL_MS,
  youtubeWatchUrl,
} from '../utils/youtubeTakeover';

/**
 * Waiting page for the browser-redirector takeover of non-local YouTube
 * videos: the backend queued an on-demand download for this video id, and
 * this page polls the takeover status endpoint until the local copy exists,
 * then hands the browser to the regular local player page. If the download
 * fails (or takes too long), the original YouTube URL is offered so the
 * takeover stays non-destructive.
 */
const YouTubeTakeoverPage: React.FC = () => {
    const { sourceId } = useParams<{ sourceId: string }>();
    const navigate = useNavigate();
    const { t } = useLanguage();

    const [timedOut, setTimedOut] = useState(false);
    const attemptsRef = useRef(0);

    useEffect(() => {
        let cancelled = false;

        const poll = async () => {
            attemptsRef.current += 1;
            try {
                const response = await fetch(
                    `/from/youtube/status/${encodeURIComponent(sourceId ?? '')}`
                );
                if (!response.ok) {
                    throw new Error(`status ${response.status}`);
                }
                const status = (await response.json()) as {
                    local: boolean;
                    videoId?: string;
                };
                if (cancelled) {
                    return;
                }
                if (status.local && status.videoId) {
                    // The local copy is ready: play it in the local player.
                    navigate(`/video/${status.videoId}`, { replace: true });
                    return;
                }
            } catch {
                // Transient network errors: keep polling.
            }
            if (cancelled) {
                return;
            }
            if (attemptsRef.current >= 100) {
                // Roughly five minutes: give up and point at YouTube.
                setTimedOut(true);
                return;
            }
            setTimeout(poll, YOUTUBE_TAKEOVER_POLL_INTERVAL_MS);
        };

        poll();

        return () => {
            cancelled = true;
        };
    }, [navigate, sourceId]);

    return (
        <Box
            sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '60vh',
                gap: 2,
                px: 2,
                textAlign: 'center',
            }}
        >
            {timedOut ? (
                <>
                    <Typography variant="h6">
                        {t('youtubeTakeoverNotReady')}
                    </Typography>
                    <Button
                        variant="contained"
                        component="a"
                        href={youtubeWatchUrl(sourceId ?? '')}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        {t('youtubeTakeoverWatchOnYoutube')}
                    </Button>
                </>
            ) : (
                <>
                    <CircularProgress />
                    <Typography variant="h6">
                        {t('youtubeTakeoverPreparing')}
                    </Typography>
                </>
            )}
        </Box>
    );
};

export default YouTubeTakeoverPage;
