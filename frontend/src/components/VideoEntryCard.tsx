import { Card, CardActionArea, CardContent, Chip } from '@mui/material';
import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { neutral, overlay } from '../theme/colors';
interface VideoEntryCardProps {
    /** Everything drawn inside the 16:9 thumbnail container (media, hover
     * preview, skeleton, ribbons, chips). The container is position:relative
     * with overflow hidden, so absolutely-positioned overlays work. */
    thumbnail: React.ReactNode;
    /** Bottom-right duration chip label; rendered when set. */
    duration?: string;
    /** Green "in library" chip in the thumbnail's top-left corner, marking
     * results the library already holds. */
    inLibrary?: boolean;
    /** Card body between the thumbnail and the actions row. */
    content: React.ReactNode;
    /** Rendered below the activation area, still inside the card: bottom
     * action rows, overlay kebab menus, modals. */
    actions?: React.ReactNode;
    /** Where the whole card activates. When set, the activation area renders
     * as a real anchor, so the browser's native link context menu (right-click
     * / middle-click "open in new tab", "copy link") works anywhere on the
     * card, exactly like on youtube.com. */
    activateHref?: string;
    /** Whole-card activation handler. The shell suppresses the anchor's
     * default navigation unless the handler calls preventDefault itself, so
     * SPA routing wins while the href stays available to the browser. */
    onActivate?: React.MouseEventHandler<HTMLElement>;
    /** Extra sx merged onto the Card (e.g. the collection highlight border). */
    sx?: Record<string, unknown>;
    /** Attached to the Card so callers can measure/observe it. */
    cardRef?: React.Ref<any>;
    /** Card-level hover handlers (hover preview, prefetch). */
    onMouseEnter?: React.MouseEventHandler<HTMLElement>;
    onMouseLeave?: React.MouseEventHandler<HTMLElement>;
}
/**
 * The one card shell every video entry renders through: the local library
 * grid (VideoCard) and the external search/channel listings
 * (ExternalVideoCard via ExternalSearchSection) share the card chrome, the
 * 16:9 thumbnail container with its duration and in-library chips, and the
 * activation area. The activation area is a real anchor pointing at the
 * card's destination, so right-clicking a video or its title offers "open in
 * new tab" / "copy link" like any other link on the web.
 *
 * The look follows the home page's modern card: transparent background,
 * rounded corners, hover tint, overlay chips.
 */
const VideoEntryCardBase: React.FC<VideoEntryCardProps> = ({
    thumbnail,
    duration,
    inLibrary = false,
    content,
    actions,
    activateHref,
    onActivate,
    sx,
    cardRef,
    onMouseEnter,
    onMouseLeave
}) => {
    const { t } = useLanguage();
    const handleActivation: React.MouseEventHandler<HTMLElement> = (event) => {
        if (!onActivate) {
            // No SPA handler: let the anchor's default navigation happen
            // (external results navigate through their takeover targets).
            return;
        }
        onActivate(event);
        // Keep the browser from also following the href after the SPA route
        // has been taken.
        if (!event.defaultPrevented) {
            event.preventDefault();
        }
    };
    return (
        <Card
            elevation={0}
            ref={cardRef}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                position: 'relative',
                bgcolor: 'transparent',
                backgroundImage: 'none',
                boxShadow: 'none',
                borderRadius: 2,
                overflow: 'visible',
                transition: 'background-color 0.15s ease, color 0.3s, border-color 0.3s',
                // Hover tint only where hovering exists; touch devices skip it.
                '@media (hover: hover) and (pointer: fine)': {
                    '&:hover': {
                        bgcolor: 'action.hover'
                    }
                },
                ...sx
            }}
        >
            <CardActionArea
                component={activateHref ? 'a' : 'div'}
                href={activateHref}
                onClick={handleActivation}
                sx={{
                    flexGrow: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'stretch',
                    borderRadius: 2,
                    color: 'inherit',
                    '& .MuiCardActionArea-focusHighlight': {
                        bgcolor: 'transparent'
                    },
                    '&.Mui-focusVisible': {
                        outline: '2px solid',
                        outlineColor: 'primary.main',
                        outlineOffset: 2
                    }
                }}
            >
                <Box16x9>
                    {thumbnail}
                    {duration && (
                        <Chip
                            label={duration}
                            size="small"
                            sx={{
                                position: 'absolute',
                                bottom: 8,
                                right: 8,
                                height: 20,
                                fontSize: '0.75rem',
                                bgcolor: overlay.black60,
                                color: neutral.white,
                                zIndex: 3
                            }}
                        />
                    )}
                    {inLibrary && (
                        <Chip
                            label={t('inLibrary')}
                            size="small"
                            color="success"
                            sx={{ position: 'absolute', top: 8, left: 8, zIndex: 3 }}
                        />
                    )}
                </Box16x9>
                <CardContent
                    sx={{
                        flexGrow: 1,
                        px: 1,
                        py: 1.5,
                        display: 'flex',
                        flexDirection: 'column',
                        minWidth: 0,
                        width: '100%'
                    }}
                >
                    {content}
                </CardContent>
            </CardActionArea>
            {actions}
        </Card>
    );
};
/** The 16:9 thumbnail container shared by every entry card. */
const Box16x9: React.FC<React.ComponentProps<'div'>> = ({ children, ...rest }) => (
    <div
        style={{ position: 'relative', paddingTop: '56.25%', borderRadius: 2, overflow: 'hidden' }}
        data-testid="video-entry-thumbnail"
        {...rest}
    >
        {children}
    </div>
);
export default VideoEntryCardBase;
