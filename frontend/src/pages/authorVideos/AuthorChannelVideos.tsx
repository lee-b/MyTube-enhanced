import { Box } from '@mui/material';
import YouTubeChannelListing from '../../components/YouTubeChannelListing';
import { useLanguage } from '../../contexts/LanguageContext';
import { channelUrlToChannelPath } from '../../utils/youtubeChannelPath';

interface AuthorChannelVideosProps {
    /** The author's channel URL, derived from the local videos the page
        already holds; the listing is only offered when it converts to a
        channel path the backend endpoint serves. */
    channelUrl?: string | null;
}

/**
 * The "all past videos" listing on an author page: everything the channel
 * has published, fetched fresh from YouTube through the same channel listing
 * endpoint and external result cards the local channel page uses. Cards for
 * videos already in the library carry the local badge and a delete action;
 * the rest would only arrive on the instance after a download (or a View,
 * which streams on demand through the takeover target).
 */
const AuthorChannelVideos: React.FC<AuthorChannelVideosProps> = ({ channelUrl }) => {
    const { t } = useLanguage();
    const channelPath = channelUrlToChannelPath(channelUrl);

    if (!channelPath) return null;

    return (
        <Box sx={{ mt: 4 }}>
            <YouTubeChannelListing key={channelPath} channelPath={channelPath} heading={t('channelVideosHeading')} />
        </Box>
    );
};

export default AuthorChannelVideos;
