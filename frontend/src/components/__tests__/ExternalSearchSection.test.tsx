import { createTheme, ThemeProvider } from '@mui/material/styles';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ExternalSearchSection from '../ExternalSearchSection';
import { VideoSearchResult } from '../../types';

vi.mock('../../contexts/LanguageContext', () => ({
    useLanguage: () => ({ t: (key: string) => key }),
}));

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

    render(
        <ThemeProvider theme={theme}>
            <ExternalSearchSection {...props} />
        </ThemeProvider>
    );

    return props;
};

describe('ExternalSearchSection', () => {
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

    it('links the platform badge to the original video in a new tab', () => {
        renderSection();

        const link = screen.getByRole('link', { name: 'originalLink' });
        expect(link).toHaveAttribute('href', 'https://www.bilibili.com/video/BV1');
        expect(link).toHaveAttribute('target', '_blank');
        expect(link).toHaveAttribute('rel', 'noopener noreferrer');
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
        it('links the video title to the takeover target for YouTube results', () => {
            renderYoutubeSection();

            const link = screen.getByRole('link', { name: 'A YouTube video' });
            expect(link).toHaveAttribute('href', '/from/youtube/video/6SxEj1cujQE');
        });

        it('links the author to the channel takeover target when the channel id is known', () => {
            renderYoutubeSection();

            const link = screen.getByRole('link', { name: 'PowerfulJRE' });
            expect(link).toHaveAttribute('href', '/from/youtube/channel/UCzQUP1qoWDoEbmsQxvdjxgQ');
        });

        it('leaves the author as plain text when no channel id came back', () => {
            renderYoutubeSection({ results: [{ ...youtubeResult, channelId: undefined }] });

            expect(screen.getByText('PowerfulJRE')).toBeInTheDocument();
            expect(screen.queryByRole('link', { name: 'PowerfulJRE' })).not.toBeInTheDocument();
        });

        it('adds a View button routing to the takeover target next to Download', () => {
            renderYoutubeSection();

            // MUI renders the Button as an anchor because it carries a href.
            const view = screen.getByRole('link', { name: /view/i });
            expect(view).toHaveAttribute('href', '/from/youtube/video/6SxEj1cujQE');
        });

        it('keeps the View button clickable even for results that are not local yet', async () => {
            // Non-local results stream through the instance instead of
            // demanding a manual download first.
            renderYoutubeSection({ results: [{ ...youtubeResult, local: false }] });

            const view = screen.getByRole('link', { name: /view/i });
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

            expect(screen.queryByRole('button', { name: /view/i })).not.toBeInTheDocument();
            expect(screen.queryByRole('link', { name: 'A Bilibili video' })).not.toBeInTheDocument();
        });
    });
});
