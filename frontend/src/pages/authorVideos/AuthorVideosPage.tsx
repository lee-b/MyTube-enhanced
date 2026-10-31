import { Box, CircularProgress, Container, Typography } from '@mui/material';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';

import ConfirmationModal from '../../components/ConfirmationModal';
import TagsModal from '../../components/TagsModal';
import { TagsSidebar } from '../../components/TagsSidebar';
import { useCollection } from '../../contexts/CollectionContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useSnackbar } from '../../contexts/SnackbarContext';
import { useVideo } from '../../contexts/VideoContext';
import { useCloudStorageUrl } from '../../hooks/useCloudStorageUrl';
import { useSettings } from '../../hooks/useSettings';
import { useVideoSort } from '../../hooks/useVideoSort';
import { useFavoriteAuthors } from '../../hooks/useFavoriteAuthors';
import AuthorVideosContent from './AuthorVideosContent';
import AuthorChannelVideos from './AuthorChannelVideos';
import AuthorVideosHeader from './AuthorVideosHeader';
import { useAuthorTagFilter } from './useAuthorTagFilter';
import { useAuthorVideoActions } from './useAuthorVideoActions';
import { getAuthorVideos, getVideoCountLabel } from './utils';
import { sortVideos } from '../../utils/videoSort';

// When the channel listing is shown, the local grid only surfaces the most
// recent downloads — the channel's full catalogue is listed right below, and
// every downloaded video appears there with its "in library" badge, so a
// complete local list would just duplicate it.
const LATEST_DOWNLOAD_LIMIT = 8;
import { viewportHeight } from '../../utils/viewportUnits';

const AuthorVideosPage: React.FC = () => {
    const { t } = useLanguage();
    const { authorName } = useParams<{ authorName: string }>();
    const { videos, loading, deleteVideo, availableTags: globalAvailableTags, updateVideo } = useVideo();
    const { collections, createCollection, addToCollection } = useCollection();
    const { showSnackbar } = useSnackbar();
    const navigate = useNavigate();
    const { data: settings } = useSettings();
    const {
        isFavorite: isFavoriteAuthor,
        toggle: toggleFavoriteAuthor,
        refreshMetadata: refreshFavoriteAuthorMetadata,
        isToggling: isFavoriteToggling,
    } = useFavoriteAuthors();

    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    // The channel listing is only offered when the local videos carry a
    // channel URL the listing endpoint can serve. Resolve it from the raw
    // videos first so the identity filter below can match by channel, not
    // just by the author display name.
    const channelUrl = useMemo(() => {
        return (
            videos
                .filter((video) => video.author === authorName)
                .find((video) => video.channelUrl)?.channelUrl ?? null
        );
    }, [videos, authorName]);
    const authorVideos = useMemo(
        () => getAuthorVideos(videos, authorName, channelUrl),
        [videos, authorName, channelUrl]
    );
    const authorDisplayName = authorVideos[0]?.author || authorName || '';
    const showTagsOnThumbnail = settings?.showTagsOnThumbnail ?? true;

    const {
        availableTags,
        selectedTags,
        commonTags,
        videosFilteredByTags,
        handleTagToggle
    } = useAuthorTagFilter(authorVideos);

    const {
        sortedVideos,
        sortOption,
        sortAnchorEl,
        handleSortClick,
        handleSortClose
    } = useVideoSort({
        videos: videosFilteredByTags,
        defaultSort: 'dateDesc'
    });

    const authorAvatarPath = useMemo(
        () => authorVideos.find((video) => video.authorAvatarPath)?.authorAvatarPath ?? null,
        [authorVideos]
    );
    const avatarUrl = useCloudStorageUrl(authorAvatarPath, 'thumbnail') ?? null;
    const favoriteAuthorDraft = useMemo(() => ({
        author: authorDisplayName,
        displayName: authorDisplayName,
        avatarPath: authorVideos.find((video) => video.authorAvatarPath)?.authorAvatarPath,
        channelUrl: authorVideos.find((video) => video.channelUrl)?.channelUrl,
    }), [authorDisplayName, authorVideos]);
    const refreshedFavoriteAuthor = useRef<string | null>(null);

    useEffect(() => {
        if (
            authorVideos.length > 0 &&
            isFavoriteAuthor(authorDisplayName) &&
            refreshedFavoriteAuthor.current !== authorDisplayName
        ) {
            refreshedFavoriteAuthor.current = authorDisplayName;
            refreshFavoriteAuthorMetadata(favoriteAuthorDraft);
        }
    }, [authorDisplayName, authorVideos.length, favoriteAuthorDraft, isFavoriteAuthor, refreshFavoriteAuthorMetadata]);

    const actions = useAuthorVideoActions({
        authorDisplayName,
        authorVideos,
        commonTags,
        collections,
        deleteVideo,
        updateVideo,
        createCollection,
        addToCollection,
        showSnackbar,
        t,
        navigateHome: () => navigate('/')
    });

    const videoCountLabel = useMemo(
        () => getVideoCountLabel(authorVideos.length, sortedVideos.length, selectedTags.length, t('videos')),
        [authorVideos.length, selectedTags.length, sortedVideos.length, t]
    );

    // With the channel listing available, the local grid shows only the latest
    // downloads (always newest-first, regardless of the header's sort menu);
    // without one, the local grid stays the complete library for the author.
    const latestDownloadedVideos = useMemo(() => {
        if (!channelUrl) {
            return sortedVideos;
        }
        return sortVideos(videosFilteredByTags, 'dateDesc').slice(0, LATEST_DOWNLOAD_LIMIT);
    }, [channelUrl, sortedVideos, videosFilteredByTags]);

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: viewportHeight(50) }}>
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Container maxWidth="xl" sx={{ py: 4 }}>
            <Box sx={{ display: 'flex', alignItems: 'stretch' }}>
                <TagsSidebar
                    isSidebarOpen={isSidebarOpen}
                    availableTags={availableTags}
                    selectedTags={selectedTags}
                    onTagToggle={handleTagToggle}
                />

                <Box sx={{ flex: 1, minWidth: 0 }}>
                    <AuthorVideosHeader
                        authorDisplayName={authorDisplayName}
                        unknownAuthorLabel={t('unknownAuthor')}
                        avatarUrl={avatarUrl}
                        videoCountLabel={videoCountLabel}
                        hasVideos={authorVideos.length > 0}
                        isBusy={actions.isCreatingCollection || actions.isDeleting}
                        addTagsLabel={t('addTags')}
                        createCollectionTooltip={t('createCollectionFromAuthorTooltip')}
                        deleteAuthorLabel={t('deleteAuthor')}
                        sortOption={sortOption}
                        sortAnchorEl={sortAnchorEl}
                        onSortClick={handleSortClick}
                        onSortClose={handleSortClose}
                        onToggleSidebar={() => {
                            setIsSidebarOpen((prev) => !prev);
                        }}
                        onOpenTagsModal={actions.openTagsModal}
                        onOpenCreateCollectionModal={actions.openCreateCollectionModal}
                        onOpenDeleteModal={actions.openDeleteModal}
                        isFavorite={isFavoriteAuthor(authorDisplayName)}
                        onToggleFavorite={() => toggleFavoriteAuthor(favoriteAuthorDraft)}
                        favoriteLabel={t('favoriteAuthor')}
                        unfavoriteLabel={t('unfavorite')}
                        favoriteDisabled={isFavoriteToggling}
                    />

                    {channelUrl && (
                        <Typography variant="h5" component="h2" fontWeight="bold" sx={{ mb: 2 }}>
                            {t('latestDownloadedVideos')}
                        </Typography>
                    )}

                    <AuthorVideosContent
                        authorVideosLength={authorVideos.length}
                        sortedVideos={latestDownloadedVideos}
                        noVideosMessage={t('noVideosForAuthor')}
                        noFilteredVideosMessage={t('noVideosFoundMatching')}
                        showTagsOnThumbnail={showTagsOnThumbnail}
                        onDeleteVideo={deleteVideo}
                    />

                    <AuthorChannelVideos channelUrl={channelUrl} />
                </Box>
            </Box>

            <ConfirmationModal
                isOpen={actions.isDeleteModalOpen}
                onClose={actions.closeDeleteModal}
                onConfirm={actions.handleDeleteAuthor}
                title={t('deleteAuthor')}
                message={t('deleteAuthorConfirmation', { author: authorDisplayName || '' })}
                confirmText={actions.isDeleting ? t('deleting') : t('delete')}
                cancelText={t('cancel')}
                isDanger={true}
            />

            <ConfirmationModal
                isOpen={actions.isCreateCollectionModalOpen}
                onClose={actions.closeCreateCollectionModal}
                onConfirm={actions.handleCreateCollectionFromAuthor}
                title={actions.createCollectionModalTitle}
                message={actions.createCollectionMessage}
                confirmText={actions.isCreatingCollection ? t('creatingCollection') : t('create')}
                cancelText={t('cancel')}
                isDanger={false}
            />

            <TagsModal
                open={actions.isTagsModalOpen}
                onClose={actions.closeTagsModal}
                identityKey={`author:${authorName ?? authorDisplayName}`}
                videoTags={commonTags}
                availableTags={globalAvailableTags}
                onSave={actions.handleSaveAuthorTags}
            />
        </Container>
    );
};

export default AuthorVideosPage;
