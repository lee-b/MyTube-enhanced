import { Button } from '@mui/material';
import { useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { useMemo, useState } from 'react';
import ConfirmationModal from './ConfirmationModal';
import SubscribeModal, { SubscribeFormValues } from './SubscribeModal';
import { useLanguage } from '../contexts/LanguageContext';
import { useSnackbar } from '../contexts/SnackbarContext';
import { SUBSCRIPTIONS_QUERY_KEY, useSubscriptions } from '../hooks/useSubscriptions';
import { api } from '../utils/apiClient';

interface SubscriptionRecord {
    id: string;
    author?: string;
    authorUrl?: string;
    platform?: string;
}

interface ChannelSubscribeButtonProps {
    /** Absolute channel URL (https://www.youtube.com/<path>) the subscription
        is created against or matched by. */
    channelUrl: string;
    /** Human-readable channel name used in the unsubscribe confirmation. */
    channelName: string;
    /** Only when the channel's real name is known (from the listing
        identity) may a subscription match by name + platform; otherwise the
        URL is the sole match key. */
    trustedName?: string;
}

/**
 * The subscribe/unsubscribe control for a channel, shared by the channel
 * page's listing and the author pages' header toolbar. Renders a Subscribe
 * button (opening the subscription options modal) or an Unsubscribe button
 * (opening a confirmation), and performs the API calls against the
 * subscriptions endpoint.
 */
const ChannelSubscribeButton: React.FC<ChannelSubscribeButtonProps> = ({
    channelUrl,
    channelName,
    trustedName,
}) => {
    const { t } = useLanguage();
    const { showSnackbar } = useSnackbar();
    const queryClient = useQueryClient();
    const { data } = useSubscriptions<SubscriptionRecord[]>();
    const subscriptions = useMemo(() => data ?? [], [data]);

    const [showSubscribeModal, setShowSubscribeModal] = useState(false);
    const [showUnsubscribeConfirm, setShowUnsubscribeConfirm] = useState(false);

    // A subscription matches this channel by its URL, or (when the channel's
    // real name is trusted) by author name + platform.
    const subscription = useMemo(() => {
        const normalizedUrl = channelUrl.replace(/\/+$/, '');
        return (
            subscriptions.find((item) => item.authorUrl?.replace(/\/+$/, '') === normalizedUrl) ??
            (trustedName
                ? subscriptions.find(
                      (item) =>
                          item.author === trustedName &&
                          item.platform?.toLowerCase() === 'youtube'
                  )
                : undefined)
        );
    }, [subscriptions, channelUrl, trustedName]);

    const handleSubscribeConfirm = async (values: SubscribeFormValues) => {
        const { interval, downloadAllPrevious, downloadShorts, downloadOrder, filenameTemplate } = values;
        try {
            await api.post('/subscriptions', {
                url: channelUrl,
                interval,
                authorName: channelName,
                downloadAllPrevious,
                downloadShorts,
                ...(downloadAllPrevious ? { downloadOrder } : {}),
                ...(filenameTemplate ? { filenameTemplate } : {}),
            });
            showSnackbar(t('subscribedSuccessfully'));
            void queryClient.invalidateQueries({ queryKey: SUBSCRIPTIONS_QUERY_KEY });
            setShowSubscribeModal(false);
        } catch (error: unknown) {
            console.error('Error subscribing to channel:', error);
            if (isAxiosError(error) && error.response?.status === 409) {
                showSnackbar(t('subscriptionAlreadyExists'), 'warning');
            } else {
                showSnackbar(t('error'), 'error');
            }
            setShowSubscribeModal(false);
        }
    };

    const handleUnsubscribeConfirm = async () => {
        if (!subscription?.id) return;
        try {
            await api.delete(`/subscriptions/${subscription.id}`);
            showSnackbar(t('unsubscribedSuccessfully'));
        } catch (error: unknown) {
            console.error('Error unsubscribing from channel:', error);
            showSnackbar(t('error'), 'error');
        }
        void queryClient.invalidateQueries({ queryKey: SUBSCRIPTIONS_QUERY_KEY });
        setShowUnsubscribeConfirm(false);
    };

    return (
        <>
            {subscription ? (
                <Button variant="outlined" size="small" onClick={() => setShowUnsubscribeConfirm(true)}>
                    {t('unsubscribe')}
                </Button>
            ) : (
                <Button variant="contained" size="small" onClick={() => setShowSubscribeModal(true)}>
                    {t('subscribe')}
                </Button>
            )}
            <SubscribeModal
                open={showSubscribeModal}
                onClose={() => setShowSubscribeModal(false)}
                onConfirm={handleSubscribeConfirm}
                authorName={channelName}
                url={channelUrl}
                source="youtube"
            />
            <ConfirmationModal
                isOpen={showUnsubscribeConfirm}
                onClose={() => setShowUnsubscribeConfirm(false)}
                onConfirm={handleUnsubscribeConfirm}
                title={t('unsubscribe')}
                message={t('confirmUnsubscribe', { author: channelName })}
                confirmText={t('unsubscribe')}
                isDanger
            />
        </>
    );
};

export default ChannelSubscribeButton;
