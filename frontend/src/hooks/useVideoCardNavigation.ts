import { useNavigate } from 'react-router';
import { Video } from '../types';
import { VideoCardCollectionInfo } from '../utils/videoCardUtils';

interface UseVideoCardNavigationProps {
    video: Video;
    collectionInfo: VideoCardCollectionInfo;
    statisticsRelatedEventId?: string | null;
    sourceCollectionId?: string | null;
    playbackQueueVideoIds?: string[];
}

/**
 * Hook to handle video card navigation logic
 * Determines whether to navigate to video player or collection page
 */
export const useVideoCardNavigation = ({
    video,
    collectionInfo,
    statisticsRelatedEventId = null,
    sourceCollectionId = null,
    playbackQueueVideoIds
}: UseVideoCardNavigationProps) => {
    const navigate = useNavigate();

    const handleVideoNavigation = () => {
        const state = {
            ...(statisticsRelatedEventId ? { statisticsRelatedEventId } : {}),
            ...(sourceCollectionId ? { sourceCollectionId } : {}),
            ...(playbackQueueVideoIds ? { playbackQueueVideoIds } : {})
        };

        // If this is the first video in a collection, navigate to the collection page
        if (collectionInfo.isFirstInAnyCollection && collectionInfo.firstCollectionId) {
            navigate(`/collection/${collectionInfo.firstCollectionId}`);
        } else {
            // Otherwise navigate to the video player page
            if (Object.keys(state).length > 0) {
                navigate(`/video/${video.id}`, { state });
                return;
            }

            navigate(`/video/${video.id}`);
        }
    };

    const handleAuthorClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        // The card's activation area is a real anchor (for right-click / new-
        // tab support), so the author click must also suppress the anchor's
        // default navigation, which would otherwise head to the video page.
        e.preventDefault();
        navigate(`/author/${encodeURIComponent(video.author)}`);
    };

    return {
        handleVideoNavigation,
        handleAuthorClick
    };
};
