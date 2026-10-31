import { Box } from '@mui/material';
import YouTubeChannelListing, { type YouTubeChannelInfo } from '../../components/YouTubeChannelListing';
import { useLanguage } from '../../contexts/LanguageContext';
import { channelUrlToChannelPath } from '../../utils/youtubeChannelPath';

interface AuthorChannelVideosProps {
    /** The author's channel URL, derived from the local videos the page
        already holds; the listing is only offered when it converts to a
        channel path the backend endpoint serves. */
    channelUrl?: string | null;
    /** Reports the channel identity the listing derived, so the page can
        render the profile details above the local videos. */
    onChannelInfo?: (info: YouTubeChannelInfo | undefined) => void;
    /** When set, the listing does not render its own channel header; the
        author page renders the profile itself, higher up. */
    hideChannelHeader?: boolean;
}

/**
 * The "all past videos" listing on an author page: everything the channel
 * has published, fetched fresh from YouTube through the same channel listing
 * endpoint and external result cards the local channel page uses. Cards for
 * videos already in the library carry the local badge and a delete action;
 * the rest would only arrive on the instance after a download (or a View,
 * which streams on demand through the takeover target).
 */
const AuthorChannelVideos: React.FC<AuthorChannelVideosProps> = ({
    channelUrl,
    onChannelInfo,
    hideChannelHeader,
}) => {
    const { t } = useLanguage();
    const channelPath = channelUrlToChannelPath(channelUrl);

    if (!channelPath) return null;

    return (
        <Box sx={{ mt: 4 }}>
            <YouTubeChannelListing
                key={channelPath}
                channelPath={channelPath}
                heading={t('channelVideosHeading')}
                hideChannelHeader={hideChannelHeader}
                onChannelInfo={onChannelInfo}
            />
        </Box>
    );
};

export default AuthorChannelVideos;
