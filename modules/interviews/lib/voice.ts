// The Interviews module's only way to reach a speech service. Production uses `elevenLabsVoice`;
// tests pass a fake.
export interface Voice {
  // The text read aloud, as audio a browser can play.
  speak(text: string): Promise<Blob>;
  // What was said in the recording. Empty when nothing could be made out, e.g. silence.
  transcribe(audio: Blob): Promise<string>;
}
