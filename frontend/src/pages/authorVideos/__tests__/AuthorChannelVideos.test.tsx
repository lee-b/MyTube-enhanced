import { createTheme, ThemeProvider } from '@mui/material/styles';
import { MemoryRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AuthorChannelVideos from '../AuthorChannelVideos';

vi.mock('../../../contexts/LanguageContext', () => ({
    useLanguage: () => ({ t: (key: string) => key }),
}));

vi.mock('../../../contexts/DownloadContext', () => ({
    useDownload: () => ({ handleVideoSubmit: vi.fn() }),
}));

vi.mock('../../../contexts/VideoContext', () => ({
    useVideo: () => ({ videos: [], deleteVideo: vi.fn(async () => ({ success: true })) }),
}));

vi.mock('../../../contexts/CollectionContext', () => ({
    useCollection: () => ({ collections: [] }),
}));

vi.mock('../../../hooks/useSettings', () => ({
    useSettings: () => ({ data: undefined }),
}));

vi.mock('../../../contexts/SnackbarContext', () => ({
    useSnackbar: () => ({ showSnackbar: vi.fn() }),
}));

vi.mock('../../../hooks/useSubscriptions', () => ({
    useSubscriptions: () => ({ data: [] }),
    SUBSCRIPTIONS_QUERY_KEY: ['subscriptions'],
}));

const fetchMock = vi.fn();

const theme = createTheme();

const queryClient = new QueryClient();

const renderSection = (channelUrl?: string | null) =>
    render(
        <QueryClientProvider client={queryClient}>
            <MemoryRouter>
                <ThemeProvider theme={theme}>
                    <AuthorChannelVideos channelUrl={channelUrl} />
                </ThemeProvider>
            </MemoryRouter>
        </QueryClientProvider>
    );

const result = (overrides: Record<string, unknown> = {}) => ({
    id: '6SxEj1cujQE',
    title: 'A channel upload',
    author: 'PowerfulJRE',
    thumbnailUrl: 'https://i.ytimg.com/thumb.jpg',
    sourceUrl: 'https://www.youtube.com/watch?v=6SxEj1cujQE',
    source: 'youtube',
    ...overrides,
});

describe('AuthorChannelVideos', () => {
    beforeEach(() => {
        fetchMock.mockReset();
        vi.stubGlobal('fetch', fetchMock);
    });

    it('renders nothing when the channel URL is missing or not a YouTube channel', () => {
        const { baseElement } = renderSection(null);
        expect(baseElement.textContent).toBe('');
        renderSection('https://www.youtube.com/watch?v=abc');
        expect(screen.queryByText('channelVideosHeading')).not.toBeInTheDocument();
    });

    it('lists the channel through the shared endpoint when the URL is a channel', async () => {
        fetchMock.mockResolvedValue({
            ok: true,
            json: async () => ({ results: [result()] }),
        });
        renderSection('https://www.youtube.com/channel/UCzQUP1qoWDoEbmsQxvdjxgQ/videos');

        await waitFor(() => expect(screen.getByText('A channel upload')).toBeInTheDocument());
        expect(fetchMock).toHaveBeenCalledWith(
            '/api/youtube/channel/channel%2FUCzQUP1qoWDoEbmsQxvdjxgQ?offset=1'
        );
        // The section heading is the author page's, not the channel name.
        expect(screen.getByText('channelVideosHeading')).toBeInTheDocument();
    });

    it('shows nothing extra on failure', async () => {
        fetchMock.mockResolvedValue({ ok: false, json: async () => ({}) });
        renderSection('https://www.youtube.com/channel/UCzQUP1qoWDoEbmsQxvdjxgQ');

        await waitFor(() => expect(screen.getByText('youtubeChannelLoadFailed')).toBeInTheDocument());
    });
});
