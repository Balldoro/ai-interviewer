// Formats a number of seconds as minutes and seconds, e.g. 84 as "1:24".
export function formatSecondsAsMinutesAndSeconds(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

// Formats a number of seconds as an ISO 8601 duration, e.g. 84 as "PT1M24S".
export function secondsToIsoDuration(seconds: number) {
  return `PT${Math.floor(seconds / 60)}M${seconds % 60}S`;
}
