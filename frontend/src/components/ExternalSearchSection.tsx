import { Box, Button, CircularProgress, Grid, Typography } from '@mui/material';
import React from 'react';
import ConfirmationModal from './ConfirmationModal';
import ExternalVideoCard from './ExternalVideoCard';
import { useLanguage } from '../contexts/LanguageContext';
import { VideoSearchResult } from '../types';
import { platform } from '../theme/colors';

interface ExternalSearchSectionProps {
    /** Which platform's results these are; drives the heading color and badge. */
    source: 'youtube' | 'bilibili';
    heading: string;
    loadingLabel: string;
    emptyLabel: string;
    results: VideoSearchResult[];
    loading: boolean;
    loadingMore: boolean;
    onLoadMore: () => void;
    onDownload: (result: VideoSearchResult) => void;
    /** Called with a result whose video is already in the library, after the
     * user confirms the removal. Optional; when absent, locally-downloaded
     * results keep the plain View/Download pair. */
    onDelete?: (result: VideoSearchResult) => void;
    /** Ids of the results whose download request has not settled yet. */
    downloadingIds: ReadonlySet<string>;
}

/**
 * One platform's block of online search results on the search page.
 *
 * YouTube and Bilibili results are the same card with a different heading and
 * badge, so both sections render through this rather than keeping two copies of
 * the grid in step by hand.
 */
const ExternalSearchSection: React.FC<ExternalSearchSectionProps> = ({
    source,
    heading,
    loadingLabel,
    emptyLabel,
    results,
    loading,
    loadingMore,
    onLoadMore,
    onDownload,
    onDelete,
    downloadingIds
}) => {
    const { t } = useLanguage();
    const [deletionTarget, setDeletionTarget] = React.useState<VideoSearchResult | null>(null);
    const sourceColor = source === 'bilibili' ? platform.bilibili : platform.youtube;
    const hasResults = results && results.length > 0;
    const isYoutube = source === 'youtube';

    return (
        <Box>
            <Typography variant="h5" sx={{ mb: 3, fontWeight: 600, color: sourceColor }}>
                {heading}
            </Typography>

            {loading ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 4 }}>
                    <CircularProgress sx={{ color: sourceColor }} />
                    <Typography sx={{ mt: 2 }}>{loadingLabel}</Typography>
                </Box>
            ) : hasResults ? (
                <>
                    <Grid container spacing={3}>
                        {results.map((result) => (
                            <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }} key={result.id}>
                                <ExternalVideoCard
                                    result={result}
                                    isYoutube={isYoutube}
                                    downloading={downloadingIds.has(result.id)}
                                    onDownload={onDownload}
                                    onDeleteRequest={onDelete ? (result) => setDeletionTarget(result) : undefined}
                                />
                            </Grid>
                        ))}
                    </Grid>
                    <Box sx={{ mt: 4, display: 'flex', justifyContent: 'center' }}>
                        <Button
                            variant="outlined"
                            onClick={onLoadMore}
                            loading={loadingMore}
                            loadingPosition="start"
                        >
                            {t('more')}
                        </Button>
                    </Box>
                </>
            ) : (
                <Typography color="text.secondary">{emptyLabel}</Typography>
            )}
            <ConfirmationModal
                isOpen={!!deletionTarget}
                onClose={() => setDeletionTarget(null)}
                onConfirm={() => {
                    if (!deletionTarget) return;
                    onDelete?.(deletionTarget);
                }}
                title={t('delete')}
                message={`${t('confirmDelete')} "${deletionTarget?.title ?? ''}"?`}
                confirmText={t('delete')}
                isDanger
            />
        </Box>
    );
};

export default ExternalSearchSection;
