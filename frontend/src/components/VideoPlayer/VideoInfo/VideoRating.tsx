import { Box, Rating, Typography } from '@mui/material';
import React from 'react';
import { useLanguage } from '../../../contexts/LanguageContext';

interface VideoRatingProps {
    rating: number | undefined;
    viewCount: number | undefined;
    showViewCounts?: boolean;
    onRatingChange: (newRating: number) => Promise<void>;
}

const VideoRating: React.FC<VideoRatingProps> = ({ rating, viewCount, showViewCounts, onRatingChange }) => {
    const { t } = useLanguage();

    const handleRatingChangeInternal = (_: React.SyntheticEvent, newValue: number | null) => {
        if (newValue) {
            onRatingChange(newValue);
        }
    };

    return (
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <Rating
                value={rating || 0}
                onChange={handleRatingChangeInternal}
            />
            <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                {rating ? `` : t('rateThisVideo')}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ ml: 2 }}>
                {showViewCounts === true
                    ? `${viewCount || 0} ${t('views')}`
                    : (viewCount ?? 0) > 0 ? t('watched') : t('unwatched')}
            </Typography>
        </Box>
    );
};

export default VideoRating;

