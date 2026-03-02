# Task 3: Implement Real-Time Transcription

## Input
- Microphone access via getUserMedia
- Audio streaming pipeline
- UI for live transcription

## Output
- Real-time transcription from microphone
- Live text display in UI
- Voice activity detection (VAD)
- Live editing during recording

## Guidelines
- Use getUserMedia for mic input
- Stream audio in small chunks to processing engine (browser/server)
- Display live transcription with <2s latency
- Implement VAD to auto-pause/resume
- Allow user to edit transcript during recording

## Functional Tests Validation
- [ ] Start/stop/pause recording from UI
- [ ] Live text appears as user speaks (mock: 5s speech)
- [ ] VAD auto-pauses on silence (mock: 3s silence)
- [ ] User can edit transcript while recording
- [ ] Latency <2s from speech to text
- [ ] Error shown if mic access denied

## Unit Testing Guidelines
- Test audio capture and chunking logic
- Test VAD algorithm with silence/noise
- Test UI state for recording, paused, editing
- Test error handling for mic permissions
