import { type Video } from '../../../types';
import { describe, expect, it } from 'vitest';
import { getAuthorVideos, normalizeChannelUrl } from '../utils';

const video = (overrides: Record<string, unknown> = {}): Video => ({
    id: 'v1',
    title: 'Video 1',
    author: 'TestAuthor',
    date: '2024-01-01',
    source: 'youtube',
    sourceUrl: 'https://www.youtube.com/watch?v=v1',
    addedAt: '2024-01-01',
    ...overrides,
} as unknown as Video);

describe('getAuthorVideos', () => {
    it('matches videos by author name', () => {
        const videos = [video(), video({ id: 'v2', author: 'Someone else' })];
        expect(getAuthorVideos(videos, 'TestAuthor')).toHaveLength(1);
    });

    it('includes videos whose channel URL matches the page channel even when the author display name drifted', () => {
        const videos = [
            // Local record captured under an old name; the page resolves the
            // channel's current display name.
            video({ id: 'v1', author: 'Old Name', channelUrl: 'https://www.youtube.com/channel/UCtest/' }),
            video({ id: 'v2', author: 'Someone else', channelUrl: 'https://www.youtube.com/channel/UCother' }),
        ];
        const result = getAuthorVideos(videos, 'TestAuthor', 'https://www.youtube.com/channel/UCtest');
        expect(result.map((entry) => entry.id)).toEqual(['v1']);
    });

    it('treats channel URLs with listing tabs and queries as the same channel', () => {
        const videos = [
            video({ id: 'v1', author: 'Other Name', channelUrl: 'https://www.youtube.com/@handle/videos?si=trace' }),
        ];
        const result = getAuthorVideos(videos, 'TestAuthor', 'https://www.youtube.com/@handle/');
        expect(result.map((entry) => entry.id)).toEqual(['v1']);
    });

    it('returns nothing without an author param', () => {
        expect(getAuthorVideos([video()], undefined)).toEqual([]);
    });
});

describe('normalizeChannelUrl', () => {
    it('strips queries, trailing slashes, and listing tabs', () => {
        expect(normalizeChannelUrl('https://www.youtube.com/channel/UCtest/')).toBe('https://www.youtube.com/channel/UCtest');
        expect(normalizeChannelUrl('https://www.youtube.com/@handle/videos?si=trace')).toBe('https://www.youtube.com/@handle');
    });
});
