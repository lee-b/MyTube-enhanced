import { DeleteOutline, Download, PlayArrow } from '@mui/icons-material';
import { Box, Button } from '@mui/material';
import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';

interface VideoEntryActionsProps {
    /** Where View routes: the local player for library videos, the platform
     * takeover target for external results. Rendered as a real anchor. Empty
     * when the entry has no player target (Bilibili stays download-only). */
    viewHref: string;
    /** Queue a download; present while the entry is not in the library. */
    onDownload?: (event: React.MouseEvent) => void;
    /** The entry's download request has not settled yet. */
    downloading?: boolean;
    /** Remove the entry from the library; present while it is. */
    onDelete?: (event: React.MouseEvent) => void;
}

/**
 * The one actions row every video entry card renders below its activation
 * area: View plus either Download (not in the library yet) or Delete
 * (already downloaded). The library grid, the external search/channel
 * listings, and every other view share this row so all cards offer the
 * same options.
 */
export const VideoEntryActions: React.FC<VideoEntryActionsProps> = ({
    viewHref,
    onDownload,
    downloading = false,
    onDelete
}) => {
    const { t } = useLanguage();

    return (
        <Box sx={{ p: 2, pt: 0, display: 'flex', gap: 1 }}>
            {viewHref && (
                <Button
                    variant="outlined"
                    startIcon={<PlayArrow />}
                    component="a"
                    href={viewHref}
                >
                    {t('view')}
                </Button>
            )}
            {onDelete ? (
                <Button
                    fullWidth
                    variant="outlined"
                    color="error"
                    startIcon={<DeleteOutline />}
                    onClick={onDelete}
                >
                    {t('delete')}
                </Button>
            ) : (
                <Button
                    fullWidth
                    variant="contained"
                    startIcon={<Download />}
                    onClick={onDownload}
                    // Per entry rather than one shared id: two downloads can
                    // legitimately be queued at once, and a single id would
                    // drop the first card's spinner and let the same entry be
                    // submitted twice.
                    loading={downloading}
                    disabled={downloading}
                    loadingPosition="start"
                >
                    {t('download')}
                </Button>
            )}
        </Box>
    );
};
