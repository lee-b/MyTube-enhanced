import { describe, expect, it } from 'vitest';
import { channelUrlToChannelPath } from '../youtubeChannelPath';

describe('channelUrlToChannelPath', () => {
    it('maps channel URLs to the backend channel path form', () => {
        expect(channelUrlToChannelPath('https://www.youtube.com/channel/UCzQUP1qoWDoEbmsQxvdjxgQ'))
            .toBe('channel/UCzQUP1qoWDoEbmsQxvdjxgQ');
        expect(channelUrlToChannelPath('https://www.youtube.com/@some.channel'))
            .toBe('@some.channel');
        expect(channelUrlToChannelPath('https://www.youtube.com/c/SomeName'))
            .toBe('c/SomeName');
    });

    it('strips a trailing tab so the endpoint does not double up /videos', () => {
        expect(channelUrlToChannelPath('https://www.youtube.com/channel/UCzQUP1qoWDoEbmsQxvdjxgQ/videos'))
            .toBe('channel/UCzQUP1qoWDoEbmsQxvdjxgQ');
        expect(channelUrlToChannelPath('https://www.youtube.com/@somechannel/streams'))
            .toBe('@somechannel');
    });

    it('rejects non-channel URLs', () => {
        expect(channelUrlToChannelPath('https://www.youtube.com/watch?v=abc')).toBeNull();
        expect(channelUrlToChannelPath('https://www.youtube.com/')).toBeNull();
        expect(channelUrlToChannelPath('https://example.com/channel/UCabc')).toBeNull();
        expect(channelUrlToChannelPath('https://www.youtube.com/user/legacy')).toBeNull();
        expect(channelUrlToChannelPath(null)).toBeNull();
        expect(channelUrlToChannelPath('not a url')).toBeNull();
    });
});
