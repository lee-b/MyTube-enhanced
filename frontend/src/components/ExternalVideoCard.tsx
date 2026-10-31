import { OndemandVideo, YouTube } from '@mui/icons-material';
import { Box, Tooltip } from '@mui/material';
import React, { useMemo } from 'react';
import { useNavigate } from 'react-router';
import VideoEntryCard from './VideoEntryCard';
import { VideoCardContent } from './VideoCard/VideoCardContent';
import { VideoCardThumbnail } from './VideoCard/VideoCardThumbnail';
import { VideoEntryActions } from './VideoCard/VideoEntryActions';
import { useLanguage } from '../contexts/LanguageContext';
import { useVideo } from '../contexts/VideoContext';
import { useVideoCardMetadata } from '../hooks/useVideoCardMetadata';
import { useVideoHoverPreview } from '../hooks/useVideoHoverPreview';
import { useVideoPrefetch } from '../hooks/useVideoPrefetch';
import { Video, VideoSearchResult } from '../types';
import { overlay, platform } from '../theme/colors';
import { formatDuration, formatViewCount } from '../utils/formatUtils';
import { getVideoCardCollectionInfo } from '../utils/videoCardUtils';

interface ExternalVideoCardProps {
    result: VideoSearchResult;
    /** YouTube results route through the takeover target; Bilibili keeps
     * download as the sole action. */
    isYoutube: boolean;
    /** The result's download request has not settled yet. */
    downloading: boolean;
    onDownload: (result: VideoSearchResult) => void;
    /** Present when the caller supports removing local copies; swaps
     * Download for Delete on results the library already holds. */
    onDeleteRequest?: (result: VideoSearchResult) => void;
}

/**
 * One external search/channel result — rendered through the *same* card
 * building blocks as the local library grid (the VideoEntryCard shell plus
 * the shared thumbnail overlays and author content), so every view of the
 * site shows one card style with hover preview, view/download/delete, and a
 * whole-card anchor for right-click "open in new tab".
 *
 * Results already in the library resolve to their local copy, which powers
 * the hover preview, the real player route, and the delete action; remote
 * results route through the platform takeover target (local player or
 * on-demand download).
 */
const ExternalVideoCard: React.FC<ExternalVideoCardProps> = ({
    result,
    isYoutube,
    downloading,
    onDownload,
    onDeleteRequest
}) => {
    const { t } = useLanguage();
    const navigate = useNavigate();
    const { videos } = useVideo();

    const isLocal = result.local === true && !!result.localVideoId;
    const canDelete = isLocal && !!onDeleteRequest;
    // The library copy behind a downloaded result: it powers the hover
    // preview, the local player route, and prefetching.
    const localVideo = useMemo(
        () => (isLocal ? videos.find((video) => video.id === result.localVideoId) : undefined),
        [isLocal, videos, result.localVideoId]
    );

    // The shared thumbnail/content hooks expect the library's Video shape;
    // synthesize it from the result, borrowing paths from the local copy
    // when the video is already downloaded.
    const pseudoVideo = useMemo<Video>(() => ({
        id: result.localVideoId ?? result.id,
        title: result.title,
        author: result.author ?? '',

        date: localVideo?.date ?? '',
        source: result.source ?? 'youtube',
        sourceUrl: result.sourceUrl ?? '',
        thumbnailUrl: result.thumbnailUrl,
        duration: result.duration !== undefined ? String(result.duration) : undefined,
        viewCount: result.viewCount,
        videoPath: localVideo?.videoPath,
        thumbnailPath: localVideo?.thumbnailPath,
        addedAt: localVideo?.addedAt ?? '',
        mediaType: localVideo?.mediaType,
        videoCollections: []
    } as Video), [result, localVideo]);

    const metadata = useVideoCardMetadata({ video: pseudoVideo });
    const hoverPreview = useVideoHoverPreview({ videoPath: pseudoVideo.videoPath });
    const { prefetchVideo } = useVideoPrefetch({ videoId: localVideo ? pseudoVideo.id : '', video: localVideo });

    const collectionInfo = useMemo(
        () => getVideoCardCollectionInfo(pseudoVideo, [], true),
        [pseudoVideo]
    );

    // The whole card activates: downloaded results open the local player,
    // YouTube results route through the takeover target (local player or
    // on-demand download), and Bilibili falls back to the source site.
    const activateHref = isLocal
        ? `/video/${result.localVideoId}`
        : isYoutube
            ? `/from/youtube/video/${result.id}`
            : (result.sourceUrl || undefined);
    const handleActivate = (event: React.MouseEvent) => {
        if (!activateHref) return;
        // The SPA route wins; the shell keeps the href for the browser's
        // context menu because we preventDefault ourselves.
        event.preventDefault();
        navigate(activateHref);
    };

    // Clicking the channel goes to its channel page: the local channel
    // listing through the takeover target (the raw UC... id gets the
    // channel/ prefix the redirect controller expects); downloaded results
    // can go straight to the author page instead.
    const channelTarget = localVideo
        ? `/author/${encodeURIComponent(result.author ?? '')}`
        : isYoutube && result.channelId
            ? `/from/youtube/channel/channel/${result.channelId}`
            : undefined;
    const handleAuthorClick = (event: React.MouseEvent) => {
        // Keep the card's own activation from also firing.
        event.stopPropagation();
        event.preventDefault();
        if (channelTarget) navigate(channelTarget);
    };

    const handleMouseEnter = () => {
        hoverPreview.handleMouseEnter();
        // Prefetch only applies to downloaded results; remote ids have no
        // library detail to prefetch.
        if (localVideo) prefetchVideo();
    };

    return (
        <VideoEntryCard
            inLibrary={result.local === true}
            duration={result.duration ? formatDuration(result.duration) : undefined}
            activateHref={activateHref}
            onActivate={handleActivate}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={hoverPreview.handleMouseLeave}
            thumbnail={
                <>
                    <VideoCardThumbnail
                        video={pseudoVideo}
                        thumbnailSrc={metadata.thumbnailSrc}
                        thumbnailCandidates={metadata.thumbnailCandidates}
                        thumbnailSrcSet={metadata.thumbnailSrcSet}
                        thumbnailSizes={metadata.thumbnailSizes}
                        videoUrl={metadata.videoUrl}
                        isHovered={hoverPreview.isHovered}
                        isVideoPlaying={hoverPreview.isVideoPlaying}
                        setIsVideoPlaying={hoverPreview.setIsVideoPlaying}
                        videoRef={hoverPreview.videoRef}
                        collectionInfo={collectionInfo}
                        isNew={metadata.isNew}
                    />
            {/* The platform badge opens the original video so it can be
                previewed before downloading. It must not be a nested anchor
                        (the whole card already is one), so it opens the source in a
                new tab from the click handler. */}
                    <Tooltip title={t('originalLink')}>
                        <Box
                            component="span"
                            role="link"
                            aria-label={t('originalLink')}
                            onClick={(event) => {
                                event.stopPropagation();
                                event.preventDefault();
                                if (result.sourceUrl) window.open(result.sourceUrl, '_blank', 'noopener,noreferrer');
                            }}
                            sx={{
                                position: 'absolute',
                                top: 8,
                                right: 8,
                                zIndex: 4,
                                bgcolor: overlay.black70,
                                borderRadius: '50%',
                                p: 0.5,
                                display: 'flex',
                                cursor: 'pointer',
                                '&:hover': { bgcolor: overlay.black90 }
                            }}
                        >
                            {result.source === 'bilibili'
                                ? <OndemandVideo sx={{ color: platform.bilibili }} />
                                : <YouTube sx={{ color: platform.youtube }} />}
                        </Box>
                    </Tooltip>
                </>
            }
            content={
                <VideoCardContent
                    video={pseudoVideo}
                    collectionInfo={collectionInfo}
                    onAuthorClick={handleAuthorClick}
                    isHovered={hoverPreview.isHovered}
                    // External results carry no upload date until downloaded.
                    dateLabel={localVideo?.date ? undefined : null}
                    viewsLabel={result.viewCount ? `${formatViewCount(result.viewCount)} ${t('views')}` : null}
                />
            }
            actions={
                <VideoEntryActions
                    viewHref={
                        // Downloaded results open the local player; YouTube
                        // results the takeover target (local player or
                        // on-demand download); Bilibili stays download-only.
                        isLocal
                            ? `/video/${result.localVideoId}`
                            : isYoutube
                                ? `/from/youtube/video/${result.id}`
                                : ''
                    }
                    onDownload={!canDelete ? () => onDownload(result) : undefined}
                    downloading={downloading}
                    onDelete={canDelete ? () => onDeleteRequest?.(result) : undefined}
                />
            }
        />
    );
};

export default ExternalVideoCard;
