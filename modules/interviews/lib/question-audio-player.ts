// A few milliseconds of silence, played to unlock the player.
const SILENCE =
  'data:audio/wav;base64,UklGRi4AAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoAAACAgICAgICAgICA';

let player: HTMLAudioElement | null = null;

/**
 * The one audio element every Question Audio plays on. Browsers block audio that starts without the
 * User interacting with the page, and Safari only lets an element play later once it has played
 * during an interaction, so the same element is kept for the whole visit.
 */
export function getQuestionAudioPlayer() {
  player ??= new Audio();
  return player;
}

/**
 * Plays silence while the User interacts with the page, e.g. clicks "Start interview", so the Question
 * Audio of the next page can play by itself.
 */
export function unlockQuestionAudio() {
  const audio = getQuestionAudioPlayer();
  // Don't cut off a Question Audio that is already playing.
  if (!audio.paused) return;

  audio.src = SILENCE;
  audio.play().catch(() => {
    // Nothing to do: the Question Audio then waits for the User to press play.
  });
}
