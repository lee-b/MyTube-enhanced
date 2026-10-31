import { createTheme, ThemeProvider } from '@mui/material/styles';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Route, Routes, MemoryRouter as Router } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ExternalSearchSection from '../../components/ExternalSearchSection';
import YouTubeChannelPage from '../YouTubeChannelPage';

vi.mock('../../contexts/LanguageContext', () => ({
    useLanguage: () => ({ t: (key: string) => key }),
}));

const handleVideoSubmit = vi.fn();
const deleteVideo = vi.fn(async () => ({ success: true }));

vi.mock('../../contexts/DownloadContext', () => ({
    useDownload: () => ({ handleVideoSubmit }),
}));

vi.mock('../../contexts/VideoContext', () => ({
    useVideo: () => ({ deleteVideo, lastSearchEventId: null }),
}));

vi.mock('../../contexts/CollectionContext', () => ({
    useCollection: () => ({ collections: [] }),
}));

const theme = createTheme();

const fetchMock = vi.fn();

const renderPage = () => render(
    <ThemeProvider theme={theme}>
        <Router initialEntries={['/channel/youtube/channel%2FUCzQUP1qoWDoEbmsQxvdjxgQ']}>
            <Routes>
                <Route path="/channel/youtube/:encodedPath" element={<YouTubeChannelPage />} />
            </Routes>
        </Router>
    </ThemeProvider>
);

const pageResult = (overrides: Partial<React.ComponentProps<typeof ExternalSearchSection>['results'][number]> = {}) => ({
    id: '6SxEj1cujQE',
    title: 'A recent upload',
    author: 'PowerfulJRE',
    channelId: 'UCzQUP1qoWDoEbmsQxvdjxgQ',
    thumbnailUrl: 'https://i.ytimg.com/thumb.jpg',
    duration: 754,
    viewCount: 4321,
    sourceUrl: 'https://www.youtube.com/watch?v=6SxEj1cujQE',
    source: 'youtube' as const,
    ...overrides,
});

describe('YouTubeChannelPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        fetchMock.mockReset();
        vi.stubGlobal('fetch', fetchMock);
    });

    it('lists the channel uploads with the channel name as heading', async () => {
        fetchMock.mockResolvedValue({
            ok: true,
            json: async () => ({ results: [pageResult()], channelPath: 'channel/UCzQUP1qoWDoEbmsQxvdjxgQ' }),
        });

        renderPage();

        // The listing is fetched from the normalized channel path.
        await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/youtube/channel/channel%2FUCzQUP1qoWDoEbmsQxvdjxgQ?offset=1'));

        expect(await screen.findByText('A recent upload')).toBeInTheDocument();
        // Heading falls back to the first entry's author when the playlist
        // does not carry a dedicated channel title.
        expect(screen.getByRole('heading', { name: 'PowerfulJRE' })).toBeInTheDocument();
    });

    it('downloads through the source URL when Download is clicked', async () => {
        fetchMock.mockResolvedValue({
            ok: true,
            json: async () => ({ results: [pageResult()], channelPath: 'channel/UCzQUP1qoWDoEbmsQxvdjxgQ' }),
        });

        renderPage();
        const card = await screen.findByText('A recent upload');

        // The card's Download button, not the "Downloaded" filter toggle
        // that also matches /download/i.
        fireEvent.click(screen.getByRole('button', { name: /^download$/i }));

        await waitFor(() => expect(handleVideoSubmit).toHaveBeenCalledWith(
            'https://www.youtube.com/watch?v=6SxEj1cujQE',
            false,
            { surface: 'web' }
        ));
        void card;
    });

    it('removes a deleted local copy from the listing', async () => {
        fetchMock.mockResolvedValue({
            ok: true,
            json: async () => ({ results: [pageResult({ local: true, localVideoId: 'local-1' })], channelPath: 'channel/UCzQUP1qoWDoEbmsQxvdjxgQ' }),
        });

        renderPage();
        await screen.findByText('A recent upload');

        fireEvent.click(screen.getByRole('button', { name: /delete/i }));
        // Confirm inside the modal (rendered after the card grid).
        const buttons = await screen.findAllByRole('button', { name: /delete/i });
        fireEvent.click(buttons[buttons.length - 1]);

        await waitFor(() => expect(deleteVideo).toHaveBeenCalledWith('local-1'));
        await waitFor(() => expect(screen.queryByText('A recent upload')).not.toBeInTheDocument());
    });

    it('shows the empty label when the channel cannot be listed', async () => {
        fetchMock.mockRejectedValue(new Error('network down'));

        renderPage();

        expect(await screen.findByText('noYouTubeResults')).toBeInTheDocument();
        expect(screen.getByText('youtubeChannelLoadFailed')).toBeInTheDocument();
    });

    it('filters the listing down to downloaded videos with the Downloaded toggle', async () => {
        fetchMock.mockResolvedValue({
            ok: true,
            json: async () => ({
                results: [pageResult({ id: 'remote-1', title: 'Remote upload' }), pageResult({ id: 'local-1', title: 'Local copy', local: true })],
                channelPath: 'channel/UCzQUP1qoWDoEbmsQxvdjxgQ',
            }),
        });

        renderPage();
        expect(await screen.findByText('Remote upload')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'channelFilterDownloaded' }));

        expect(screen.queryByText('Remote upload')).not.toBeInTheDocument();
        expect(screen.getByText('Local copy')).toBeInTheDocument();

        // Back to All restores the full catalogue.
        fireEvent.click(screen.getByRole('button', { name: 'channelFilterAll' }));
        expect(screen.getByText('Remote upload')).toBeInTheDocument();
        expect(screen.getByText('Local copy')).toBeInTheDocument();
    });

    it('shows the dedicated empty label when no channel video is downloaded', async () => {
        fetchMock.mockResolvedValue({
            ok: true,
            json: async () => ({ results: [pageResult()], channelPath: 'channel/UCzQUP1qoWDoEbmsQxvdjxgQ' }),
        });

        renderPage();
        await screen.findByText('A recent upload');

        fireEvent.click(screen.getByRole('button', { name: 'channelFilterDownloaded' }));

        expect(await screen.findByText('noDownloadedChannelVideos')).toBeInTheDocument();
    });
});
