/** Shared typography for video entry card titles: the library grid and the
 * external search/channel listings clamp their titles the same two-line way. */
export const videoEntryTitleSx = {
    fontWeight: 600,
    lineHeight: 1.2,
    mb: 1,
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden'
} as const;
