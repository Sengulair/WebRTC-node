const GsmProxy = require('./gsm-proxy');
const gsmDevice = new GsmProxy();
process.on('SIGINT', function() {
  gsmDevice.destruct();
});
gsmDevice.init();//.then( () => console.log(gsmDevice.getId()));

/*
process.exit(0);
const {
  Transform,
  Readable
} = require('node:stream');


const {
  RTCPeerConnection,
  nonstandard,
  MediaStream
} = require('wrtc');
const recorder = require('node-record-lpcm16');
const Speaker = require('speaker');

const resempleMonoToStereo = (samples) => {
  const monoBuffer = Buffer.from(samples.buffer);
  const stereoBuffer = Buffer.alloc(monoBuffer.length * 2);

  for (let i = 0; i < monoBuffer.length / 2; i++) {
    const sample = monoBuffer.readUInt16LE(i * 2);
    stereoBuffer.writeUInt16LE(sample, i * 4);
    stereoBuffer.writeUInt16LE(sample, i * 4 + 2);
  }

  return stereoBuffer;
}

async function* handleOffer(offer) {
  debugLog('--handleOffer');
  debugLog(offer);
  await pc.setRemoteDescription(offer);
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  send2exs({
    type: 'webRTCAnswer',
    answer: pc.localDescription
  });
}

async function* handleCandidate(candidate) {
  if (!candidate || !candidate.candidate) return;
  debugLog('--handleCandidate');
  debugLog(candidate);
  await pc.addIceCandidate(candidate);
};

const audioConfig = {
  sampleRate: 48000,
  channels: 1,
  bitDepth: 16,
}

const WEBRTC_AUDIO_FRAME_IN_SEC = 0.01;
const BIT_IN_BYTE = 8;
const AUDIOCARD_INDEX = process.env.AUDIOCARD_INDEX;

const recording = recorder.record({
  recorder: 'sox',
  sampleRate: audioConfig.sampleRate,
  channels: audioConfig.channels,
  device: 'plughw:CARD=Device,DEV=0', //`plughw:${AUDIOCARD_INDEX}`,
})
const speaker = new Speaker({
  channels: 2,
  bitDepth: audioConfig.bitDepth,
  sampleRate: audioConfig.sampleRate,
  device: 'plughw:CARD=Device,DEV=0', //`hw:${AUDIOCARD_INDEX},0`,
});

const recordingStream = recording.stream();

const pc = new RTCPeerConnection(null);

function createChunker(size) {
  let buffers = [];
  let length = 0;

  return new Transform({
    transform(chunk, encoding, callback) {
      buffers.push(chunk);
      length += chunk.length;

      if (length >= size) {
        const all = Buffer.concat(buffers);
        for (let i = 0; i <= all.length - size; i += size) {
          this.push(all.subarray(i, i + size));
        }

        const rest = all.subarray(Math.floor(length / size) * size);
        buffers = [rest];
        length = rest.length;
      }
      callback();
    },
    flush(callback) {
      callback();
    }
  });
}

const audioChunker = createChunker(audioConfig.bitDepth / BIT_IN_BYTE * audioConfig.sampleRate * WEBRTC_AUDIO_FRAME_IN_SEC * audioConfig.channels);
recordingStream.pipe(audioChunker);

const audioStream = new MediaStream();
const audioSource = new nonstandard.RTCAudioSource();
const audioTrack = audioSource.createTrack();

audioChunker.on('data', (data) => {
  const frame = {
    bitsPerSample: audioConfig.bitDepth,
    sampleRate: audioConfig.sampleRate,
    channelCount: audioConfig.channels,
    numberOfFrames: audioConfig.sampleRate * WEBRTC_AUDIO_FRAME_IN_SEC,
    samples: new Int16Array(new Uint8Array(data).buffer),
  }
  audioSource.onData(frame)
})

pc.addTrack(audioTrack, audioStream);

pc.ontrack = function(event) {
  if (event.track.kind === 'audio') {
    const audioTrack = event.track;

    const sink = new nonstandard.RTCAudioSink(audioTrack);

    const readable = new Readable({
      read() {}
    });

    readable.pipe(speaker);

    sink.ondata = (data) => {
      const stereoBuffer = resempleMonoToStereo(data.samples)

      readable.push(stereoBuffer);
    }
  }
}

pc.onicecandidate = (event) => {
  if (!event.candidate) return;
  send2exs({
    type: 'ICECandidate',
    candidate: event.candidate
  });
};
*/