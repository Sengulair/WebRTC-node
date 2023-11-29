const { Readable } = require('node:stream');

const Speaker = require('speaker');
const { nonstandard } = require('wrtc');

const { createWSMessaging, createRTCPeerConnection } = require('./shared.js');

const pc = createRTCPeerConnection();

pc.ontrack = function (event) {
  if (event.track.kind === 'audio') {
    const audioTrack = event.track;

    const sink = new nonstandard.RTCAudioSink(audioTrack);

    const speaker = new Speaker({
      channels: 1,
      bitDepth: 16,
      sampleRate: 44100
    });

    const readable = new Readable({
      read() {}
    });

    readable.pipe(speaker);

    sink.ondata = (data) => {
      const buffer = Buffer.from(data.samples.buffer);
      readable.push(buffer);
    }
  }
}

createWSMessaging(pc);