const {
  Transform,
  Readable
} = require('node:stream');

const dotenv = require('dotenv');

const WebSocket = require('ws');
const serialportgsm = require('serialport-gsm');
const {
  RTCPeerConnection,
  nonstandard,
  MediaStream
} = require('wrtc');
const recorder = require('node-record-lpcm16');
const Speaker = require('speaker');

/**
 * @param {Int16Array} samples
 * @returns Buffer
 */
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

dotenv.config();

var gsmModem;
// -----------------------------------------------------------------------------

function debugLog(message) {
  console.log(message)
}

function send2exs(obj, callback) {
  ws.send(JSON.stringify(obj), callback);
}

function send2exs_status(data, callback) {
  send2exs({type:'device', data: data}, callback);
}

// -----------------------------------------------------------------------------

debugLog('Exchange Server - Connecting `' + process.env.EXCHANGE_SERVER_WEBSOCKET_URL + '`...');
const ws = new WebSocket(process.env.EXCHANGE_SERVER_WEBSOCKET_URL);
ws.addEventListener('open', () => {
  debugLog('Exchange Server - Connected');
  debugLog('Exchange Server - Sending token...');
  send2exs({
    type: 'token',
    token: process.env.TOKEN
  }, () => {
    debugLog('Exchange Server - Token Sent');
    send2exs_status({code: 'START'}, () => {
      connectModem();
    })
  });
});

ws.addEventListener('close', (code, reason) => {
  debugLog('Exchange Server - Disconnected with code' + code);
  debugLog(reason);
  send2exs_status({code: 'STOP', num: code});
});

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

function handleCommandExecution(message) {
  const command = message.data;
  gsmModem.executeCommand(command, (result, err) => {
    var rslt = {};
    if (err) {
      rslt.error = err;
    } else {
      rslt.success = true;
      rslt.tag = message.tag;
      rslt.data = result.data;
    }
    ws.send(JSON.stringify({
      type: 'device-answer',
      content: JSON.stringify(rslt)
    }))
  });
}

ws.addEventListener('message', async (event) => {
  var message = null;
  try {
    message = JSON.parse(event.data);
    if (!message.type) {
      throw "Message type not found";
    }
  } catch (e) {
    debugLog('ERROR: ' + e + ' when parsing message (' + JSON.stringify(event) + ')');
    return;
  }
  debugLog(message);

  try {
    switch (message.type) {
      case 'webRTCOffer':
        handleOffer(message.offer);
        break;
      case 'ICECandidate':
        handleCandidate(message.candidate);
        break;
      case 'cmd':
        handleCommandExecution(message);
        break;
      case 'ping':
        // Ignore and skip;
        break;
      default:
        debugLog('Unknown message type: ' + message.type);
        break;
    }
  } catch (e) {
    debugLog('ERROR: ' + e + ' when executing message.');
  }
});

// -----------------------------------------------------------------------------

function connectModem() {
  debugLog(`Modem - Connecting...`);
  gsmModem = serialportgsm.Modem()

  gsmModem.on('open', () => {
    debugLog(`Modem - Connected`);

    gsmModem.on('close', data => {
      debugLog(`Modem - Disconnected : ` + JSON.stringify(data));
    });
  });

  gsmModem.open(process.env.SERIALPORT_PATH, {
    baudRate: 115200,
    logger: {
      debug: (text) => {
        debugLog(text);
      }
    }
  });
}

// -----------------------------------------------------------------------------

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
