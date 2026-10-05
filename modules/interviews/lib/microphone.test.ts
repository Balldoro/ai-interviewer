import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { openMicrophone, releaseMicrophone } from './microphone';

const getUserMedia = vi.fn<MediaDevices['getUserMedia']>();

// A stream whose tracks record whether they were stopped.
function fakeStream() {
  const track = { stop: vi.fn() };
  const stream = { active: true, getTracks: () => [track] };
  return {
    stream: stream as unknown as MediaStream,
    track,
    setActive: (active: boolean) => (stream.active = active),
  };
}

beforeEach(() => {
  Object.defineProperty(navigator, 'mediaDevices', {
    value: { getUserMedia },
    configurable: true,
  });
});

afterEach(async () => {
  // The microphone is kept between calls, so each test starts without one.
  await releaseMicrophone();
  Reflect.deleteProperty(navigator, 'mediaDevices');
  getUserMedia.mockReset();
});

describe('openMicrophone', () => {
  it('asks for the microphone with the browser’s default processing', async () => {
    const { stream } = fakeStream();
    getUserMedia.mockResolvedValue(stream);

    expect(await openMicrophone()).toBe(stream);
    expect(getUserMedia).toHaveBeenCalledExactlyOnceWith({ audio: true });
  });

  it('keeps the microphone open from one call to the next', async () => {
    const { stream, track } = fakeStream();
    getUserMedia.mockResolvedValue(stream);

    await openMicrophone();

    expect(await openMicrophone()).toBe(stream);
    expect(getUserMedia).toHaveBeenCalledOnce();
    expect(track.stop).not.toHaveBeenCalled();
  });

  it('asks only once when called again before access is granted', async () => {
    const { stream } = fakeStream();
    const { promise, resolve } = Promise.withResolvers<MediaStream>();
    getUserMedia.mockReturnValue(promise);

    const first = openMicrophone();
    const second = openMicrophone();
    resolve(stream);

    expect(await first).toBe(stream);
    expect(await second).toBe(stream);
    expect(getUserMedia).toHaveBeenCalledOnce();
  });

  it('asks again once the microphone stopped working, e.g. when it was unplugged', async () => {
    const unplugged = fakeStream();
    const replacement = fakeStream();
    getUserMedia.mockResolvedValueOnce(unplugged.stream).mockResolvedValueOnce(replacement.stream);

    await openMicrophone();
    unplugged.setActive(false);

    expect(await openMicrophone()).toBe(replacement.stream);
    expect(getUserMedia).toHaveBeenCalledTimes(2);
  });

  it('asks again after a request failed, e.g. because access was denied', async () => {
    const denied = new DOMException('Permission denied', 'NotAllowedError');
    const { stream } = fakeStream();
    getUserMedia.mockRejectedValueOnce(denied).mockResolvedValueOnce(stream);

    await expect(openMicrophone()).rejects.toBe(denied);

    expect(await openMicrophone()).toBe(stream);
    expect(getUserMedia).toHaveBeenCalledTimes(2);
  });
});

describe('releaseMicrophone', () => {
  it('stops the microphone, so the next call asks for it again', async () => {
    const first = fakeStream();
    const second = fakeStream();
    getUserMedia.mockResolvedValueOnce(first.stream).mockResolvedValueOnce(second.stream);

    await openMicrophone();
    await releaseMicrophone();

    expect(first.track.stop).toHaveBeenCalledOnce();
    expect(await openMicrophone()).toBe(second.stream);
    expect(getUserMedia).toHaveBeenCalledTimes(2);
  });

  it('stops a microphone whose access is granted only after it was released', async () => {
    const { stream, track } = fakeStream();
    const { promise, resolve } = Promise.withResolvers<MediaStream>();
    getUserMedia.mockReturnValue(promise);

    void openMicrophone();
    const released = releaseMicrophone();
    resolve(stream);
    await released;

    expect(track.stop).toHaveBeenCalledOnce();
  });

  it('does nothing when the microphone isn’t open', async () => {
    await expect(releaseMicrophone()).resolves.toBeUndefined();
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it('does nothing when the request for the microphone failed', async () => {
    const { promise, reject } = Promise.withResolvers<MediaStream>();
    getUserMedia.mockReturnValue(promise);

    const opening = openMicrophone();
    const released = releaseMicrophone();
    reject(new DOMException('Permission denied', 'NotAllowedError'));

    await expect(opening).rejects.toThrow('Permission denied');
    await expect(released).resolves.toBeUndefined();
  });
});
