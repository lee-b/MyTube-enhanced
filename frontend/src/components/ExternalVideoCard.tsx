import { DeleteOutline, Download, OndemandVideo, PlayArrow, YouTube } from '@mui/icons-material';
import { Box, Button, CardMedia, Tooltip, Typography, useTheme } from '@mui/material';
import React from 'react';
import VideoEntryCard from './VideoEntryCard';
import { useLanguage } from '../contexts/LanguageContext';
import { VideoSearchResult } from '../types';
import { overlay, platform } from '../theme/colors';
import { videoEntryTitleSx } from '../utils/videoEntryStyles';
import { formatDuration, formatViewCount } from '../utils/formatUtils';
import { authorAvatarFallbackSx } from '../utils/authorAvatarStyles';
import { THUMBNAIL_PLACEHOLDER_SRC, setThumbnailPlaceholder } from '../utils/thumbnailPlaceholder';

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

/** Small circular avatar with the author's initial, matching the library
 * grid's author row. */
const AuthorAvatar: React.FC<{ author?: string }> = ({ author }) => {
    const theme = useTheme();
    return (
        <Box
            aria-hidden
            sx={{
                width: 24,
                height: 24,
                minWidth: 24,
                fontSize: '0.75rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '50%',
                flexShrink: 0,
                ...authorAvatarFallbackSx(theme)
            }}
        >
            {author ? author.charAt(0).toUpperCase() : 'A'}
        </Box>
    );
};

const authorRowSx = {
    mb: 1,
    display: 'flex',
    alignItems: 'center',
    gap: 0.75,
    minWidth: 0
} as const;

/**
 * One external search/channel result rendered through the shared
 * VideoEntryCard shell, so the search listings and the local library grid
 * share one card rendering code path and one modern look.
 *
 * The backend flags results already held by the library, so every card says
 * plainly whether the video is local (with delete) or would arrive on the
 * instance only after a download. Titles and author names are real anchors,
 * so right-click / middle-click "open in new tab" works like on the source
 * site.
 */
const ExternalVideoCard: React.FC<ExternalVideoCardProps> = ({
    result,
    isYoutube,
    downloading,
    onDownload,
    onDeleteRequest
}) => {
    const { t } = useLanguage();
    const isLocal = result.local === true && !!result.localVideoId;
    const canDelete = isLocal && !!onDeleteRequest;

    return (
        <VideoEntryCard
            inLibrary={result.local === true}
            duration={result.duration ? formatDuration(result.duration) : undefined}
            thumbnail={
                <>
                    <CardMedia
                        component="img"
                        image={result.thumbnailUrl || THUMBNAIL_PLACEHOLDER_SRC}
                        alt={result.title}
                        // Bilibili's CDN answers 403 to a hotlinked request from
                        // any other origin, so the thumbnail only loads when the
                        // browser sends no Referer. YouTube's CDN does not care
                        // either way.
                        referrerPolicy="no-referrer"
                        sx={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={(e) => {
                            setThumbnailPlaceholder(e.currentTarget);
                        }}
                    />
                    {/* The platform badge opens the original video so it can be
                        previewed before downloading. It stays inside the
                        thumbnail slot: external results have no whole-card
                        anchor (their click targets are the title, the author,
                        and the action buttons), so this anchor is not nested
                        inside another one. */}
                    <Tooltip title={t('originalLink')}>
                        <Box
                            component="a"
                            href={result.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={t('originalLink')}
                            sx={{ position: 'absolute', top: 8, right: 8, bgcolor: overlay.black70, borderRadius: '50%', p: 0.5, display: 'flex', zIndex: 4, '&:hover': { bgcolor: overlay.black90 } }}
                        >
                            {result.source === 'bilibili'
                                ? <OndemandVideo sx={{ color: platform.bilibili }} />
                                : <YouTube sx={{ color: platform.youtube }} />}
                        </Box>
                    </Tooltip>
                </>
            }
            content={
                <>
                    <Typography gutterBottom variant="subtitle1" component="div" sx={videoEntryTitleSx}>
                        {/* YouTube results route through the takeover target so a
                            locally-downloaded video opens in the local player;
                            non-local ones stream through the instance (or fall
                            back to youtube.com when no stream is servable). */}
                        {isYoutube ? (
                            <a
                                href={`/from/youtube/video/${result.id}`}
                                style={{ color: 'inherit', textDecoration: 'none' }}
                            >
                                {result.title}
                            </a>
                        ) : (
                            result.title
                        )}
                    </Typography>
                    {isYoutube && result.channelId ? (
                        <Typography variant="body2" color="text.secondary" sx={authorRowSx}>
                            <AuthorAvatar author={result.author} />
                            <a
                                // The takeover target expects the youtube.com-relative
                                // channel path form, so the raw UC... id gets the
                                // channel/ prefix — otherwise the redirect controller
                                // does not recognize it and bounces to youtube.com.
                                href={`/from/youtube/channel/channel/${result.channelId}`}
                                style={{ color: 'inherit', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                            >
                                {result.author}
                            </a>
                        </Typography>
                    ) : (
                        <Typography variant="body2" color="text.secondary" sx={authorRowSx}>
                            <AuthorAvatar author={result.author} />
                            <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {result.author}
                            </Box>
                        </Typography>
                    )}
                    {result.viewCount && (
                        <Typography variant="caption" color="text.secondary">
                            {formatViewCount(result.viewCount)} {t('views')}
                        </Typography>
                    )}
                </>
            }
            actions={
                <Box sx={{ p: 2, pt: 0, display: 'flex', gap: 1 }}>
                    {/* Only YouTube results have a takeover target; Bilibili keeps
                        download as the sole action. The backend serves the local
                        player when the video is in the library and streams it
                        through the instance when it is not, so View is always
                        clickable for YouTube results. */}
                    {isYoutube && (
                        <Button
                            variant="outlined"
                            startIcon={<PlayArrow />}
                            component="a"
                            href={`/from/youtube/video/${result.id}`}
                        >
                            {t('view')}
                        </Button>
                    )}
                    {canDelete ? (
                        <Button
                            fullWidth
                            variant="outlined"
                            color="error"
                            startIcon={<DeleteOutline />}
                            onClick={() => onDeleteRequest?.(result)}
                        >
                            {t('delete')}
                        </Button>
                    ) : (
                        <Button
                            fullWidth
                            variant="contained"
                            startIcon={<Download />}
                            onClick={() => onDownload(result)}
                            // Per result rather than one shared id: two downloads
                            // can legitimately be queued at once, and a single id
                            // would drop the first card's spinner and let the same
                            // result be submitted twice.
                            loading={downloading}
                            disabled={downloading}
                            loadingPosition="start"
                        >
                            {t('download')}
                        </Button>
                    )}
                </Box>
            }
        />
    );
};

export default ExternalVideoCard;
