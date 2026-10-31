import { createTheme, ThemeProvider } from '@mui/material/styles';
import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ExternalSearchSection from '../ExternalSearchSection';
import { VideoSearchResult } from '../../types';

vi.mock('../../contexts/LanguageContext', () => ({
    useLanguage: () => ({ t: (key: string) => key }),
}));

const mockNavigate = vi.fn();
vi.mock('react-router', async () => {
    const actual = await vi.importActual<typeof import('react-router')>('react-router');
    return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('../../contexts/VideoContext', () => ({
    useVideo: () => ({ videos: [] }),
}));

vi.mock('../../hooks/useSettings', () => ({
    useSettings: () => ({ data: undefined }),
}));

const queryClient = new QueryClient();
const windowOpen = vi.fn();
const locationAssign = vi.fn();

const withProviders = (ui: React.ReactElement) => render(
    <MemoryRouter>
        <QueryClientProvider client={queryClient}>
            <ThemeProvider theme={createTheme()}>{ui}</ThemeProvider>
        </QueryClientProvider>
    </MemoryRouter>
);

const theme = createTheme();

const bilibiliResult: VideoSearchResult = {
    id: 'BV1',
    title: 'A Bilibili video',
    author: 'Some UP',
    thumbnailUrl: 'https://i2.hdslb.com/cover.jpg',
    duration: 754,
    viewCount: 4321,
    sourceUrl: 'https://www.bilibili.com/video/BV1',
    source: 'bilibili',
};

const youtubeResult: VideoSearchResult = {
    id: '6SxEj1cujQE',
    title: 'A YouTube video',
    author: 'PowerfulJRE',
    channelId: 'UCzQUP1qoWDoEbmsQxvdjxgQ',
    thumbnailUrl: 'https://i.ytimg.com/thumb.jpg',
    duration: 754,
    viewCount: 4321,
    sourceUrl: 'https://www.youtube.com/watch?v=6SxEj1cujQE',
    source: 'youtube',
    local: true,
};

const renderYoutubeSection = (overrides: Partial<React.ComponentProps<typeof ExternalSearchSection>> = {}) =>
    renderSection({
        source: 'youtube',
        heading: 'fromYouTube',
        loadingLabel: 'loadingYouTubeResults',
        emptyLabel: 'noYouTubeResults',
        results: [youtubeResult],
        ...overrides,
    });

const renderSection = (overrides: Partial<React.ComponentProps<typeof ExternalSearchSection>> = {}) => {
    const props: React.ComponentProps<typeof ExternalSearchSection> = {
        source: 'bilibili',
        heading: 'fromBilibili',
        loadingLabel: 'loadingBilibiliResults',
        emptyLabel: 'noBilibiliResults',
        results: [bilibiliResult],
        loading: false,
        loadingMore: false,
        onLoadMore: vi.fn(),
        onDownload: vi.fn(),
        downloadingIds: new Set<string>(),
        ...overrides,
    };

    withProviders(
        <ThemeProvider theme={theme}>
            <ExternalSearchSection {...props} />
        </ThemeProvider>
    );

    return props;
};

describe('ExternalSearchSection', () => {
    beforeEach(() => {
        mockNavigate.mockReset();
        windowOpen.mockReset();
        locationAssign.mockReset();
        vi.stubGlobal('open', windowOpen);
        const originalLocation = window.location;
        Object.defineProperty(window, 'location', {
            configurable: true,
            value: { ...originalLocation, assign: locationAssign },
            writable: true,
        });
        return () => {
            Object.defineProperty(window, 'location', {
                configurable: true,
                value: originalLocation,
                writable: true,
            });
        };
    });

    it('renders the heading and a card per result', () => {
        renderSection();

        expect(screen.getByText('fromBilibili')).toBeInTheDocument();
        expect(screen.getByText('A Bilibili video')).toBeInTheDocument();
        expect(screen.getByText('Some UP')).toBeInTheDocument();
        // 754 seconds, formatted by the shared duration helper.
        expect(screen.getByText('12:34')).toBeInTheDocument();
        expect(screen.getByText('4.3K views')).toBeInTheDocument();
    });

    it('shows the loading label instead of results while loading', () => {
        renderSection({ loading: true });

        expect(screen.getByText('loadingBilibiliResults')).toBeInTheDocument();
        expect(screen.queryByText('A Bilibili video')).not.toBeInTheDocument();
    });

    it('shows the empty label when the source returned nothing', () => {
        renderSection({ results: [] });

        expect(screen.getByText('noBilibiliResults')).toBeInTheDocument();
        expect(screen.queryByText('more')).not.toBeInTheDocument();
    });

    it('opens the platform badge in a new tab without leaving the card', () => {
        renderSection();

        // The badge is not a nested anchor (the whole card already is one),
        // so it opens the original video from the click handler.
        fireEvent.click(screen.getByRole('link', { name: 'originalLink' }));
        expect(windowOpen).toHaveBeenCalledWith('https://www.bilibili.com/video/BV1', '_blank', 'noopener,noreferrer');
    });

    it('hands the whole result back on download so the caller keeps its source URL', () => {
        const props = renderSection();

        fireEvent.click(screen.getByRole('button', { name: /download/i }));

        expect(props.onDownload).toHaveBeenCalledWith(bilibiliResult);
    });

    it('blocks a second click on a result whose download is still in flight', () => {
        const props = renderSection({ downloadingIds: new Set(['BV1']) });

        const button = screen.getByRole('button', { name: /download/i });
        expect(button).toBeDisabled();

        fireEvent.click(button);
        expect(props.onDownload).not.toHaveBeenCalled();
    });

    it('leaves another result downloadable while one is in flight', () => {
        const other: VideoSearchResult = { ...bilibiliResult, id: 'BV2', title: 'Another video' };
        const props = renderSection({
            results: [bilibiliResult, other],
            downloadingIds: new Set(['BV1']),
        });

        // Queueing a second download is legitimate, so only the busy card locks.
        const buttons = screen.getAllByRole('button', { name: /download/i });
        expect(buttons[0]).toBeDisabled();
        expect(buttons[1]).toBeEnabled();

        fireEvent.click(buttons[1]);
        expect(props.onDownload).toHaveBeenCalledWith(other);
    });

    it('loads the next page on demand', () => {
        const props = renderSection();

        fireEvent.click(screen.getByRole('button', { name: /more/i }));

        expect(props.onLoadMore).toHaveBeenCalled();
    });

    describe('youtube local-first links', () => {
        it('anchors the whole card to the video takeover target for YouTube results', () => {
            renderYoutubeSection();

            // The card's activation area is a real anchor (thumbnail, title,
            // background — the whole card), like the front page's cards.
            const anchor = screen.getByRole('link', { name: /A YouTube video/ });
            expect(anchor).toHaveAttribute('href', '/from/youtube/video/6SxEj1cujQE');
        });

        it('hands the author click to the browser for the takeover target', () => {
            renderYoutubeSection();

            fireEvent.click(screen.getByText('PowerfulJRE'));
            // Takeover targets resolve server-side (no SPA route exists),
            // so the click must be a full navigation, not SPA routing.
            expect(locationAssign).toHaveBeenCalledWith('/from/youtube/channel/channel/UCzQUP1qoWDoEbmsQxvdjxgQ');
            expect(mockNavigate).not.toHaveBeenCalled();
        });

        it('lets the browser follow the card anchor to the takeover target', () => {
            renderYoutubeSection();

            // SPA navigation to a takeover URL renders a blank page, so the
            // card activation must leave the anchor's default in place.
            fireEvent.click(screen.getByRole('link', { name: /A YouTube video/ }));
            expect(mockNavigate).not.toHaveBeenCalled();
        });

        it('leaves the author a no-op when no channel id came back', () => {
            renderYoutubeSection({ results: [{ ...youtubeResult, channelId: undefined }] });

            fireEvent.click(screen.getByText('PowerfulJRE'));
            expect(mockNavigate).not.toHaveBeenCalled();
        });

        it('adds a View button routing to the takeover target next to Download', () => {
            renderYoutubeSection();

            // MUI renders the Button as an anchor because it carries a href.
            // The whole-card activation anchor also matches /view/i (its name
            // contains the views count), so match the button exactly.
            const view = screen.getByRole('link', { name: 'view' });
            expect(view).toHaveAttribute('href', '/from/youtube/video/6SxEj1cujQE');
        });

        it('keeps the View button clickable even for results that are not local yet', async () => {
            // Non-local results stream through the instance instead of
            // demanding a manual download first.
            renderYoutubeSection({ results: [{ ...youtubeResult, local: false }] });

            const view = screen.getByRole('link', { name: 'view' });
            expect(view).toBeEnabled();
            expect(view).toHaveAttribute('href', '/from/youtube/video/6SxEj1cujQE');
        });

        it('badges results that are already in the library', () => {
            renderYoutubeSection();
            expect(screen.getByText('inLibrary')).toBeInTheDocument();
        });

        it('omits the library badge for results that are not local', () => {
            renderYoutubeSection({ results: [{ ...youtubeResult, local: false }] });
            expect(screen.queryByText('inLibrary')).not.toBeInTheDocument();
        });

        it('omits the library badge when the local flag is absent', () => {
            renderYoutubeSection({ results: [{ ...youtubeResult, local: undefined }] });
            expect(screen.queryByText('inLibrary')).not.toBeInTheDocument();
        });

        it('swaps Download for Delete on results that are already in the library', () => {
            const props = renderYoutubeSection({
                results: [{ ...youtubeResult, local: true, localVideoId: 'local-1' }],
                onDelete: vi.fn(),
            });

            expect(screen.queryByRole('button', { name: /download/i })).not.toBeInTheDocument();
            const del = screen.getByRole('button', { name: /delete/i });
            expect(del).toBeEnabled();
            expect(props.onDelete).not.toHaveBeenCalled();
        });

        it('keeps the Download button when the local copy is not visible to the caller', () => {
            renderYoutubeSection({
                // Backend only annotates localVideoId for visible copies.
                results: [{ ...youtubeResult, local: true, localVideoId: undefined }],
                onDelete: vi.fn(),
            });

            expect(screen.getByRole('button', { name: /download/i })).toBeInTheDocument();
            expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
        });

        it('keeps the plain View/Download pair when no delete handler is wired', () => {
            renderYoutubeSection({
                results: [{ ...youtubeResult, local: true, localVideoId: 'local-1' }],
            });

            expect(screen.getByRole('button', { name: /download/i })).toBeInTheDocument();
            expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
        });

        it('only hands the confirmed result to onDelete after the modal is confirmed', async () => {
            const onDelete = vi.fn();
            renderYoutubeSection({
                results: [{ ...youtubeResult, local: true, localVideoId: 'local-1' }],
                onDelete,
            });

            fireEvent.click(screen.getByRole('button', { name: /delete/i }));
            // The modal asks before anything is deleted.
            expect(onDelete).not.toHaveBeenCalled();

            // Confirm inside the modal (rendered after the card grid). The
            // dialog mounts behind a transition, so wait for its button.
            const buttons = await screen.findAllByRole('button', { name: /delete/i });
            fireEvent.click(buttons[buttons.length - 1]);
            expect(onDelete).toHaveBeenCalledTimes(1);
            expect(onDelete).toHaveBeenCalledWith(expect.objectContaining({ id: '6SxEj1cujQE', localVideoId: 'local-1' }));
        });

        it('keeps Bilibili cards download-only', () => {
            renderSection();

            expect(screen.queryByRole('button', { name: 'view' })).not.toBeInTheDocument();
            // Without a takeover target, the card falls back to the source
            // site's watch page.
            const anchor = screen.getByRole('link', { name: /A Bilibili video/ });
            expect(anchor).toHaveAttribute('href', 'https://www.bilibili.com/video/BV1');
        });
    });
});
