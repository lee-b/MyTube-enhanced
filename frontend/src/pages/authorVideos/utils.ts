import { Collection, Video } from '../../types';

type NamedCollection = Collection & {
    title?: string;
};

/**
 * Normalizes a channel URL for identity comparison: strips query strings,
 * trailing slashes, and trailing listing tabs (e.g. /videos) so that a video
 * recorded from youtube.com/@handle and a URL captured from the channel page
 * compare equal even when the author display names differ.
 */
export const normalizeChannelUrl = (url: string): string => {
    const withoutQuery = url.split(/[?#]/, 1)[0].replace(/\/+$/, '');
    return withoutQuery.replace(/\/(videos|shorts|playlists|streams|featured)$/, '');
};

export const getAuthorVideos = (
    videos: Video[],
    authorParam?: string,
    channelUrl?: string | null
): Video[] => {
    if (!authorParam) {
        return [];
    }
    const normalizedChannelUrl = channelUrl ? normalizeChannelUrl(channelUrl) : null;
    return videos.filter((video) => {
        // Author display names can drift from the channel's canonical name
        // (renames, truncation, redirector-provided handles), so a video whose
        // channel URL matches the page's channel belongs on the page even when
        // its author string does not match.
        if (
            normalizedChannelUrl &&
            video.channelUrl &&
            normalizeChannelUrl(video.channelUrl) === normalizedChannelUrl
        ) {
            return true;
        }
        return video.author === authorParam;
    });
};

export const getAvailableAuthorTags = (authorVideos: Video[]): string[] => {
    const tags = authorVideos.flatMap((video) => video.tags || []);
    return Array.from(new Set(tags)).sort();
};

export const getCommonAuthorTags = (authorVideos: Video[]): string[] => {
    if (authorVideos.length === 0) {
        return [];
    }

    const firstVideoTags = new Set(authorVideos[0].tags || []);
    const intersection = authorVideos.slice(1).reduce((result, video) => {
        const currentTags = new Set(video.tags || []);
        return new Set([...result].filter((tag) => currentTags.has(tag)));
    }, firstVideoTags);

    return Array.from(intersection).sort();
};

export const filterAuthorVideosByTags = (
    authorVideos: Video[],
    selectedTags: string[]
): Video[] => {
    if (selectedTags.length === 0) {
        return authorVideos;
    }

    return authorVideos.filter((video) =>
        selectedTags.every((tag) => (video.tags || []).includes(tag))
    );
};

export const findAuthorCollection = (
    collections: Collection[],
    authorDisplayName: string
): NamedCollection | undefined => {
    return collections.find((collection) => {
        const collectionName = collection.name || (collection as NamedCollection).title || '';
        return collectionName === authorDisplayName;
    }) as NamedCollection | undefined;
};

export const getVideosMissingFromCollection = (
    authorVideos: Video[],
    targetCollection: Collection | null
): Video[] => {
    if (!targetCollection) {
        return authorVideos;
    }
    return authorVideos.filter((video) => !targetCollection.videos.includes(video.id));
};

export const getVideosInOtherCollectionsCount = (
    authorVideos: Video[],
    collections: Collection[],
    targetCollection: Collection | null
): number => {
    return authorVideos.filter((video) => {
        if (targetCollection && targetCollection.videos.includes(video.id)) {
            return false;
        }
        return collections.some((collection) => collection.videos.includes(video.id));
    }).length;
};

export const getVideoCountLabel = (
    totalVideos: number,
    filteredVideos: number,
    selectedTagCount: number,
    videosText: string
): string => {
    if (totalVideos === 0) {
        return `0 ${videosText}`;
    }
    if (selectedTagCount > 0) {
        return `${filteredVideos} / ${totalVideos} ${videosText}`;
    }
    return `${totalVideos} ${videosText}`;
};

export const buildUpdatedTags = (
    originalTags: string[] | undefined,
    tagsToAdd: string[],
    tagsToRemove: string[]
): string[] => {
    const baseTags = originalTags || [];
    const tagsWithAdditions = tagsToAdd.length > 0
        ? Array.from(new Set([...baseTags, ...tagsToAdd]))
        : baseTags;
    return tagsToRemove.length > 0
        ? tagsWithAdditions.filter((tag) => !tagsToRemove.includes(tag))
        : tagsWithAdditions;
};

export const getTagDiff = (
    oldCommonTags: string[],
    newCommonTags: string[]
): { tagsToAdd: string[]; tagsToRemove: string[] } => {
    const tagsToAdd = newCommonTags.filter((tag) => !oldCommonTags.includes(tag));
    const tagsToRemove = oldCommonTags.filter((tag) => !newCommonTags.includes(tag));
    return { tagsToAdd, tagsToRemove };
};
