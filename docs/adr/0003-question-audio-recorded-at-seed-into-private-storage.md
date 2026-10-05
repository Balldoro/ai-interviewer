# Question Audio is recorded at seed time into a private Supabase Storage bucket

Each Question Text is spoken once, by `pnpm db:seed`, and the audio is stored in a private Supabase Storage bucket under a hash of the exact text. Identical texts share one recording. Before recording, the seed lists the bucket, records only the missing hashes, and deletes the ones no Question Text uses any more. It records only when seeding the Supabase database (`DATABASE_CA_CERT` is set). Local runs and tests never call ElevenLabs: storage is faked, and one dummy audio file stands in for every Question Audio. We chose this so that a User never waits for text-to-speech and no page visit costs ElevenLabs credits. With a question bank heading towards a thousand Questions, each one must be paid for once, not on every visit and not every time a local database is wiped.

The bucket is private so that the files can't be fetched, hotlinked or scripted from outside the app. When a User loads an Interview step, the server signs a 60-second URL for that User's own current Interview Question only. The client downloads it at once into a `blob:` URL and replays from memory, so the short expiry never interrupts playback.

Considered and rejected:

- Recording on the Interview page: the User waits, and every visit pays.
- A Postgres table: a wiped local database would pay again for every Question Text.
- Committing the mp3s to git: rejected by the maintainer.
- A public bucket: the files could be hotlinked, costing Supabase bandwidth.

The hash covers only the text, not the voice or model, so changing the voice means clearing the bucket by hand.
