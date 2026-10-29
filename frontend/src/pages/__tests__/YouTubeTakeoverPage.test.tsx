import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import YouTubeTakeoverPage from '../YouTubeTakeoverPage';

const routerMocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  useParams: vi.fn(() => ({ sourceId: '6SxEj1cujQE' })),
}));

vi.mock('react-router', () => ({
  // useNavigate must RETURN the spy; otherwise the hook call itself is
  // recorded with no args and the page's navigate ends up undefined.
  useNavigate: () => routerMocks.navigate,
  useParams: routerMocks.useParams,
}));

vi.mock('../../contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: (key: string) => key }),
}));

describe('YouTubeTakeoverPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routerMocks.navigate.mockReset();
    routerMocks.useParams.mockReturnValue({ sourceId: '6SxEj1cujQE' });
    // Only fake the timers the page polls with; leave microtask channels
    // (queueMicrotask, MessageChannel) real so React can flush updates.
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    global.fetch = vi.fn() as unknown as typeof global.fetch;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const fetchMock = (): ReturnType<typeof vi.fn> =>
    global.fetch as unknown as ReturnType<typeof vi.fn>;

  it('navigates to the local player when the video becomes local', async () => {
    let pollCount = 0;
    fetchMock().mockImplementation(async () => {
      pollCount += 1;
      // The download takes a couple of polls to finish.
      return {
        ok: true,
        json: async () =>
          pollCount < 2
            ? { local: false, queued: true }
            : { local: true, videoId: '1786820657381' },
      };
    });

    render(<YouTubeTakeoverPage />);

    await vi.advanceTimersByTimeAsync(6000);

    expect(routerMocks.navigate).toHaveBeenCalledWith('/video/1786820657381', {
      replace: true,
    });
    expect(pollCount).toBe(2);
  });

  it('keeps polling while the video is not local yet', async () => {
    let pollCount = 0;
    fetchMock().mockImplementation(async () => {
      pollCount += 1;
      return {
        ok: true,
        json: async () => ({ local: false, queued: true }),
      };
    });

    render(<YouTubeTakeoverPage />);

    await vi.advanceTimersByTimeAsync(6000);

    expect(pollCount).toBeGreaterThanOrEqual(2);
    expect(routerMocks.navigate).not.toHaveBeenCalled();
  });

  it('shows a determinate progress bar with the reported percent', async () => {
    fetchMock().mockImplementation(async () => ({
      ok: true,
      json: async () => ({ local: false, queued: true, progress: 42, speed: '12 MiB/s' }),
    }));

    render(<YouTubeTakeoverPage />);

    await act(async () => {});
    await vi.advanceTimersByTimeAsync(3000);
    await act(async () => {});

    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '42');
    expect(screen.getByText(/42%/)).toBeInTheDocument();
    expect(screen.getByText(/12 MiB\/s/)).toBeInTheDocument();
    expect(routerMocks.navigate).not.toHaveBeenCalled();
  });

  it('offers YouTube as the non-destructive fallback after the wait times out', async () => {
    let pollCount = 0;
    fetchMock().mockImplementation(async () => {
      pollCount += 1;
      return {
        ok: true,
        json: async () => ({ local: false, queued: true }),
      };
    });

    render(<YouTubeTakeoverPage />);

    // 100 attempts at a 3-second interval: roughly five minutes, then the
    // page gives up and points at the original YouTube URL.
    await vi.advanceTimersByTimeAsync(100 * 3000 + 1000);

    // Flush React's pending state updates after the fake timers ran.
    await act(async () => {});

    expect(pollCount).toBe(100);
    expect(screen.getByText('youtubeTakeoverNotReady')).toBeInTheDocument();

    const fallback = screen.getByRole('link', {
      name: 'youtubeTakeoverWatchOnYoutube',
    });
    expect(fallback).toHaveAttribute(
      'href',
      'https://www.youtube.com/watch?v=6SxEj1cujQE'
    );
  });
});
