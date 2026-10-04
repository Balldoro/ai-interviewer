// The Interviews module's only way to reach a speech service. Production uses `elevenLabsVoice`;
// tests pass a fake.
export interface Voice {
  // What was said in the recording. Empty when nothing could be made out, e.g. silence.
  transcribe(audio: Blob): Promise<string>;
}
