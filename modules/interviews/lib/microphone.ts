let microphone: Promise<MediaStream> | null = null;

/**
 * The microphone, kept open from one recording to the next and asked for again only if it stopped
 * working, e.g. when it was unplugged. Safari cuts the speakers for a moment a few seconds after a
 * microphone is released, which would be while the next Question Audio plays, so it is released
 * only by `releaseMicrophone`.
 */
export function openMicrophone() {
  const opening =
    microphone?.then((stream) => (stream.active ? stream : requestMicrophone())) ??
    requestMicrophone();

  microphone = opening;
  // A request that failed, e.g. because access was denied, is asked again next time.
  opening.catch(() => {
    if (microphone === opening) microphone = null;
  });

  return opening;
}

// Also releases a microphone whose access is granted only afterwards.
export async function releaseMicrophone() {
  const released = microphone;
  microphone = null;

  const stream = await released?.catch(() => null);
  stream?.getTracks().forEach((track) => track.stop());
}

function requestMicrophone() {
  return navigator.mediaDevices.getUserMedia({ audio: true });
}
