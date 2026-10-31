import { Container } from '@mui/material';
import { useParams } from 'react-router';
import YouTubeChannelListing from '../components/YouTubeChannelListing';

/**
 * Local page for a YouTube channel reached through the browser-redirector
 * takeover target (/from/youtube/channel/<path>) when the channel is not in
 * the library. The listing itself lives in the shared YouTubeChannelListing
 * component, which the author pages reuse for their "all past videos"
 * section.
 *
 * The page is keyed by the channel path so navigating to another channel
 * remounts it with fresh state instead of resetting through an effect.
 */
const YouTubeChannelPage: React.FC = () => {
    const { encodedPath } = useParams<{ encodedPath: string }>();

    const channelPath = encodedPath ?? '';

    return (
        <Container maxWidth="xl" sx={{ py: 4 }}>
            <YouTubeChannelListing key={channelPath} channelPath={channelPath} />
        </Container>
    );
};

export default YouTubeChannelPage;
