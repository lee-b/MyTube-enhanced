import {
    useMediaQuery,
    useTheme
} from '@mui/material';
import React from 'react';
import VideoEntryCard from './VideoEntryCard';
import { useVideoTags } from '../contexts/VideoContext';
import { usePlayerSelection } from '../hooks/usePlayerSelection';
import { useVideoCardActions } from '../hooks/useVideoCardActions';
import { useVideoCardMetadata } from '../hooks/useVideoCardMetadata';
import { useVideoCardNavigation } from '../hooks/useVideoCardNavigation';
import { useVideoHoverPreview } from '../hooks/useVideoHoverPreview';
import { useVideoPrefetch } from '../hooks/useVideoPrefetch';
import { Collection, Video } from '../types';
import { formatDuration } from '../utils/formatUtils';
import { getVideoCardCollectionInfo } from '../utils/videoCardUtils';
import { VideoCardActions } from './VideoCard/VideoCardActions';
import { VideoCardContent } from './VideoCard/VideoCardContent';
import { VideoCardThumbnail } from './VideoCard/VideoCardThumbnail';

interface VideoCardProps {
    video: Video;
    collections?: Collection[];
    onDeleteVideo?: (id: string) => Promise<any>;
    showDeleteButton?: boolean;
    disableCollectionGrouping?: boolean;
    statisticsRelatedEventId?: string | null;
    sourceCollectionId?: string | null;
    playbackQueueVideoIds?: string[];
    isAboveTheFold?: boolean; // For LCP optimization
    isHeroImage?: boolean;
    showTagsOnThumbnail?: boolean;
    onTagClick?: (tag: string) => void;
}

const VideoCardBase: React.FC<VideoCardProps> = ({
    video,
    collections = [],
    onDeleteVideo,
    showDeleteButton = false,
    disableCollectionGrouping = false,
    statisticsRelatedEventId = null,
    sourceCollectionId = null,
    playbackQueueVideoIds,
    isAboveTheFold = false,
    isHeroImage = false,
    showTagsOnThumbnail = false,
    onTagClick
}) => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const isTouch = useMediaQuery('(hover: none), (pointer: coarse)');
    const { availableTags, selectedTags, handleTagToggle } = useVideoTags();

    // Get collection information
    const collectionInfo = getVideoCardCollectionInfo(
        video,
        collections,
        disableCollectionGrouping
    );

    // Hooks for different concerns
    const hoverPreview = useVideoHoverPreview({ videoPath: video.videoPath });
    const metadata = useVideoCardMetadata({ video });
    const playerSelection = usePlayerSelection({
        video,
        getVideoUrl: metadata.getVideoUrl
    });
    const actions = useVideoCardActions({
        video,
        onDeleteVideo,
        showDeleteButton
    });
    const navigation = useVideoCardNavigation({
        video,
        collectionInfo,
        statisticsRelatedEventId,
        sourceCollectionId,
        playbackQueueVideoIds
    });
    const { prefetchVideo, cardRef } = useVideoPrefetch({
        videoId: video.id,
        video
    });

    const handleMouseEnter = () => {
        hoverPreview.handleMouseEnter();
        // Also prefetch on hover as an additional optimization
        prefetchVideo();
    };

    // The whole card activates through a real anchor, so the browser's native
    // link context menu (right-click / middle-click "open in new tab") works
    // anywhere on the card, like it does on youtube.com. Collection-first
    // cards land on their collection page; everything else opens the player.
    const activateHref = collectionInfo.isFirstInAnyCollection && collectionInfo.firstCollectionId
        ? `/collection/${collectionInfo.firstCollectionId}`
        : `/video/${video.id}`;

    return (
        <VideoEntryCard
            cardRef={cardRef}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={hoverPreview.handleMouseLeave}
            activateHref={activateHref}
            onActivate={navigation.handleVideoNavigation}
            duration={video.duration ? formatDuration(video.duration) : undefined}
            thumbnail={
                <VideoCardThumbnail
                    video={video}
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
                    isAboveTheFold={isAboveTheFold}
                    isHeroImage={isHeroImage}
                    showTagsOnThumbnail={showTagsOnThumbnail}
                    availableTags={availableTags}
                    selectedTags={selectedTags}
                    onTagClick={onTagClick ?? handleTagToggle}
                />
            }
            content={
                <VideoCardContent
                    video={video}
                    collectionInfo={collectionInfo}
                    onAuthorClick={navigation.handleAuthorClick}
                    isHovered={hoverPreview.isHovered}
                />
            }
            actions={
                <VideoCardActions
                    video={video}
                    playerMenuAnchor={playerSelection.playerMenuAnchor}
                    setPlayerMenuAnchor={playerSelection.setPlayerMenuAnchor}
                    handlePlayerSelect={playerSelection.handlePlayerSelect}
                    getAvailablePlayers={playerSelection.getAvailablePlayers}
                    showDeleteModal={actions.showDeleteModal}
                    setShowDeleteModal={actions.setShowDeleteModal}
                    confirmDelete={actions.confirmDelete}
                    isDeleting={actions.isDeleting}
                    handleToggleVisibility={actions.handleToggleVisibility}
                    isTogglingVisibility={actions.isTogglingVisibility}
                    canDelete={actions.canDelete}
                    isMobile={isMobile}
                    isTouch={isTouch}
                    isHovered={hoverPreview.isHovered}
                />
            }
            sx={{
                border: collectionInfo.isFirstInAnyCollection
                    ? `1px solid ${theme.palette.primary.main}`
                    : 'none'
            }}
        />
    );
};

/**
 * Memoized so a card only re-renders when its own props change. The grids render
 * many of these, and the VideoContext value is now memoized, so cards skip
 * re-rendering on unrelated context changes (e.g. search typing). A custom
 * comparator guards the array/object props that callers may recreate.
 */
const VideoCard = React.memo(VideoCardBase, (prevProps, nextProps) => {
    if (prevProps.video !== nextProps.video) return false;
    if (prevProps.onDeleteVideo !== nextProps.onDeleteVideo) return false;
    if (prevProps.showDeleteButton !== nextProps.showDeleteButton) return false;
    if (prevProps.disableCollectionGrouping !== nextProps.disableCollectionGrouping) return false;
    if (prevProps.statisticsRelatedEventId !== nextProps.statisticsRelatedEventId) return false;
    if (prevProps.sourceCollectionId !== nextProps.sourceCollectionId) return false;
    if (prevProps.isAboveTheFold !== nextProps.isAboveTheFold) return false;
    if (prevProps.isHeroImage !== nextProps.isHeroImage) return false;
    if (prevProps.showTagsOnThumbnail !== nextProps.showTagsOnThumbnail) return false;
    if (prevProps.onTagClick !== nextProps.onTagClick) return false;
    // collections / playbackQueueVideoIds are arrays; compare by reference then length.
    if (prevProps.collections !== nextProps.collections) return false;
    if (prevProps.playbackQueueVideoIds !== nextProps.playbackQueueVideoIds) return false;
    return true;
});

export default VideoCard;
