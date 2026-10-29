import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { VideoCardContent } from '../VideoCardContent';

// Mock dependencies
vi.mock('../../../contexts/LanguageContext', () => ({
    useLanguage: () => ({ t: (key: string) => key }),
}));

const mockSettingsData: { showViewCounts?: boolean } = {};
vi.mock('../../../hooks/useSettings', () => ({
    useSettings: () => ({ data: mockSettingsData }),
}));

vi.mock('../../../utils/formatUtils', () => ({
    formatDate: () => '2023-01-01',
    formatRelativeDownloadTime: () => '2023-01-01',
}));


describe('VideoCardContent', () => {
    const mockOnAuthorClick = vi.fn();
    const defaultVideo = {
        id: '1',
        title: 'Test Video Title',
        author: 'Test Author',
        viewCount: 100,
    } as any;

    const defaultCollectionInfo = {
        isFirstInAnyCollection: false,
        firstInCollectionNames: [],
        videoCollections: [],
        firstCollectionId: null,
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render video details correctly', () => {
        render(
            <VideoCardContent
                video={defaultVideo}
                collectionInfo={defaultCollectionInfo}
                onAuthorClick={mockOnAuthorClick}
            />
        );

        expect(screen.getByText('Test Video Title')).toBeInTheDocument();
        expect(screen.getByText('Test Author')).toBeInTheDocument();
        expect(screen.getByText('2023-01-01')).toBeInTheDocument();
        // View counts are internal by default: cards show watched status.
        expect(screen.queryByText('100 views')).not.toBeInTheDocument();
        expect(screen.getByText('watched')).toBeInTheDocument();
    });

    it('shows the internal view count only when the deployment opts in', () => {
        mockSettingsData.showViewCounts = true;
        try {
            render(
                <VideoCardContent
                    video={defaultVideo}
                    collectionInfo={defaultCollectionInfo}
                    onAuthorClick={mockOnAuthorClick}
                />
            );
            expect(screen.getByText('100 views')).toBeInTheDocument();
            expect(screen.queryByText('unwatched')).not.toBeInTheDocument();
        } finally {
            delete mockSettingsData.showViewCounts;
        }
    });

    it('marks watched videos as watched instead of showing counts', () => {
        render(
            <VideoCardContent
                video={{ ...defaultVideo, viewCount: 2 }}
                collectionInfo={defaultCollectionInfo}
                onAuthorClick={mockOnAuthorClick}
            />
        );
        expect(screen.queryByText('2 views')).not.toBeInTheDocument();
        expect(screen.getByText('watched')).toBeInTheDocument();
    });

    it('should handle author click', async () => {
        const user = userEvent.setup();
        render(
            <VideoCardContent
                video={defaultVideo}
                collectionInfo={defaultCollectionInfo}
                onAuthorClick={mockOnAuthorClick}
            />
        );

        await user.click(screen.getByText('Test Author'));
        expect(mockOnAuthorClick).toHaveBeenCalled();
    });

    it('should render collection info if first in collection', () => {
        const collectionInfo = {
            isFirstInAnyCollection: true,
            firstInCollectionNames: ['My Playlist'],
            videoCollections: [],
            firstCollectionId: 'col1',
        };

        render(
            <VideoCardContent
                video={defaultVideo}
                collectionInfo={collectionInfo}
                onAuthorClick={mockOnAuthorClick}
            />
        );

        expect(screen.getByText('My Playlist')).toBeInTheDocument();
        expect(screen.queryByText('Test Video Title')).not.toBeInTheDocument();
    });

    it('should render multiple collections info', () => {
        const collectionInfo = {
            isFirstInAnyCollection: true,
            firstInCollectionNames: ['My Playlist', 'Favorites'],
            videoCollections: [],
            firstCollectionId: 'col1',
        };

        render(
            <VideoCardContent
                video={defaultVideo}
                collectionInfo={collectionInfo}
                onAuthorClick={mockOnAuthorClick}
            />
        );

        expect(screen.getByText('My Playlist')).toBeInTheDocument();
        expect(screen.getByText('+1')).toBeInTheDocument();
    });

    it('delays marquee animation after each repeated hover', () => {
        vi.useFakeTimers();
        const cancelAnimation = vi.fn();
        const animate = vi.fn(() => ({ cancel: cancelAnimation }) as unknown as Animation);
        const originalAnimate = HTMLElement.prototype.animate;
        const scrollWidthSpy = vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(240);
        const clientWidthSpy = vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(100);
        HTMLElement.prototype.animate = animate as typeof HTMLElement.prototype.animate;

        try {
            const rendered = render(
                <VideoCardContent
                    video={defaultVideo}
                    collectionInfo={defaultCollectionInfo}
                    onAuthorClick={mockOnAuthorClick}
                />
            );

            rendered.rerender(
                <VideoCardContent
                    video={defaultVideo}
                    collectionInfo={defaultCollectionInfo}
                    onAuthorClick={mockOnAuthorClick}
                    isHovered
                />
            );

            expect(animate).not.toHaveBeenCalled();

            act(() => {
                vi.advanceTimersByTime(300);
            });

            expect(animate).toHaveBeenCalledTimes(1);

            rendered.rerender(
                <VideoCardContent
                    video={defaultVideo}
                    collectionInfo={defaultCollectionInfo}
                    onAuthorClick={mockOnAuthorClick}
                />
            );
            rendered.rerender(
                <VideoCardContent
                    video={defaultVideo}
                    collectionInfo={defaultCollectionInfo}
                    onAuthorClick={mockOnAuthorClick}
                    isHovered
                />
            );

            expect(animate).toHaveBeenCalledTimes(1);

            act(() => {
                vi.advanceTimersByTime(299);
            });

            expect(animate).toHaveBeenCalledTimes(1);

            act(() => {
                vi.advanceTimersByTime(1);
            });

            expect(animate).toHaveBeenCalledTimes(2);
        } finally {
            scrollWidthSpy.mockRestore();
            clientWidthSpy.mockRestore();
            if (originalAnimate) {
                HTMLElement.prototype.animate = originalAnimate;
            } else {
                delete (HTMLElement.prototype as Partial<HTMLElement>).animate;
            }
            vi.useRealTimers();
        }
    });
});
