import { Avatar, Box, Stack, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useState } from 'react';
import { type YouTubeChannelInfo } from '../../components/YouTubeChannelListing';
import { useLanguage } from '../../contexts/LanguageContext';
import { authorAvatarFallbackSx } from '../../utils/authorAvatarStyles';
import { formatViewCount } from '../../utils/formatUtils';

interface AuthorChannelProfileProps {
    /** Channel identity reported by the channel listing (name, subscriber
        count, blurb, avatar). */
    channelInfo: YouTubeChannelInfo;
    /** Fallback name when the listing has not supplied one yet. */
    fallbackName: string;
}

/**
 * The channel profile details on an author page: the channel's own avatar,
 * name, subscriber count, and description, rendered above the local videos
 * once the channel listing has reported the identity. Subscribe controls are
 * not part of this block — they live in the author header toolbar next to
 * the other author actions.
 */
const AuthorChannelProfile: React.FC<AuthorChannelProfileProps> = ({
    channelInfo,
    fallbackName,
}) => {
    const { t } = useLanguage();
    const theme = useTheme();
    const [avatarFailed, setAvatarFailed] = useState(false);
    const name = channelInfo.name || fallbackName;

    return (
        <Stack direction="row" spacing={2} alignItems="flex-start" sx={{ mb: 3 }}>
            {channelInfo.thumbnailUrl && !avatarFailed ? (
                <Box
                    component="img"
                    src={channelInfo.thumbnailUrl}
                    alt={name}
                    referrerPolicy="no-referrer"
                    onError={() => setAvatarFailed(true)}
                    sx={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover' }}
                />
            ) : (
                <Avatar sx={{ ...authorAvatarFallbackSx(theme), width: 64, height: 64, fontSize: 28 }}>
                    {name.charAt(0).toUpperCase()}
                </Avatar>
            )}
            <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="h5" component="h2" fontWeight="bold" noWrap>
                    {name}
                </Typography>
                {channelInfo.subscriberCount !== undefined && (
                    <Typography variant="body2" color="text.secondary">
                        {`${formatViewCount(channelInfo.subscriberCount)} ${t('channelSubscribers')}`}
                    </Typography>
                )}
                {channelInfo.description && (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1, whiteSpace: 'pre-line' }}>
                        {channelInfo.description}
                    </Typography>
                )}
            </Box>
        </Stack>
    );
};

export default AuthorChannelProfile;
