const { RTCPeerConnection, nonstandard, MediaStream } = require('wrtc');
const recorder = require('node-record-lpcm16');

const { createWSMessaging } = require('./shared.js');

const recording = recorder.record({ 
  recorder: 'sox',
  sampleRate: 44100,
})
const recordingStream = recording.stream();

const config = {
  iceServers: [
    {
      urls: 'turn:relay1.expressturn.com:3478',
      username: 'ef18IC3W3OAFOU3ZW1',
      credential: 'ZBFMwQhMIXk6DROS',
      credentialType: 'password'
    }
  ]
};

const pc = new RTCPeerConnection(config);

class NodeWebRtcAudioStreamSource extends nonstandard.RTCAudioSource {
  addStream(
    readable,
    bitsPerSample = 16,
    sampleRate = 44100,
    channelCount = 1
  ) {
    let cache = Buffer.alloc(0);
    let streamEnd = false;
    readable.on('data', buffer => {
      cache = Buffer.concat([cache, buffer]);
    });

    readable.on('end', () => {
      streamEnd = true;
    });

    const processData = () => {
      const byteLength =
        ((sampleRate * bitsPerSample) / 8 / 100) * channelCount; // node-webrtc audio by default every 10ms, it is 1/100 second
      if (cache.length >= byteLength || streamEnd) {
        const buffer = cache.slice(0, byteLength);
        cache = cache.slice(byteLength);
        const samples = new Int16Array(new Uint8Array(buffer).buffer);
        this.onData({
          bitsPerSample,
          sampleRate,
          channelCount,
          numberOfFrames: samples.length,
          type: 'data',
          samples,
        });
      }
      if (!streamEnd || cache.length >= byteLength) {
        setTimeout(() => processData(), 10); // every 10 ms, required by node-webrtc audio https://github.com/node-webrtc/node-webrtc/blob/develop/CHANGELOG.md#rtcaudiosource
      }
    };
    processData();
  }
}

const audioSource = new NodeWebRtcAudioStreamSource();
audioSource.addStream(recordingStream);
const track = audioSource.createTrack();
const stream = new MediaStream([track]);
pc.addTrack(track, stream);

createWSMessaging(pc, true);