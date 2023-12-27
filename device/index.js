const { Transform, Readable } = require('node:stream');

const WebSocket = require('ws');
const { RTCPeerConnection, nonstandard, MediaStream } = require('wrtc');
const dotenv = require('dotenv');
const recorder = require('node-record-lpcm16');
const Speaker = require('speaker');
const serialportgsm = require('serialport-gsm')

dotenv.config();

console.log(process.env.EXCHANGE_SERVER_WEBSOCKET_URL);

const ws = new WebSocket(process.env.EXCHANGE_SERVER_WEBSOCKET_URL);
let tokenSended = false;

var gsmModem = serialportgsm.Modem()
let options = {
  baudRate: 19200,
  dataBits: 8,
  parity: 'none',
  stopBits: 1,
  xon: false,
  rtscts: false,
  xoff: false,
  xany: false,
  autoDeleteOnReceive: true,
  enableConcatenation: true,
  incomingCallIndication: true,
  incomingSMSIndication: true,
  pin: '',
  customInitCommand: 'AT^CURC=0',
  cnmiCommand:'AT+CNMI=2,1,0,2,1',

  logger: {
    debug: (text) => {
      if (ws.readyState === ws.OPEN && tokenSended) {
        console.log(JSON.stringify({ type: 'deviceLog', content: text }));
        ws.send(JSON.stringify({ type: 'deviceLog', content: text }))
      }
    }
  }
}

gsmModem.on('open', () => {
  console.log(`Modem Sucessfully Opened`);

  gsmModem.initializeModem((msg, err) => {
    if (err) {
      console.log(`Error Initializing Modem - ${err}`);
    } else {
      console.log(`InitModemResponse: ${JSON.stringify(msg)}`);
    }
  });

  gsmModem.on('close', data => {
    console.log(`Event Close: ` + JSON.stringify(data));
  });
});

gsmModem.open(process.env.SERIALPORT_PATH, options);

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
  device: `plughw:${AUDIOCARD_INDEX}`,
})
const speaker = new Speaker({
  channels: 2,
  bitDepth: audioConfig.bitDepth,
  sampleRate: audioConfig.sampleRate,
  device: `hw:${AUDIOCARD_INDEX},0`,
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

pc.ontrack = function (event) {
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

ws.addEventListener('open', function open() {
  console.log('exchange server connected');
  ws.send(JSON.stringify({ type: 'token', token: process.env.TOKEN }));
  tokenSended = true;
});

const handleOffer = async offer => {
  console.log('handleOffer', offer);
  await pc.setRemoteDescription(offer);
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  ws.send(JSON.stringify({ type: 'webRTCAnswer', answer: pc.localDescription }));
};

const handleCandidate = async candidate => {
  console.log('handleCandidate', candidate);
  await pc.addIceCandidate(candidate);
};

const handleCommand = (command) => {
  gsmModem.executeCommand(command, (result, err) => {
    const commandResult = err ? `Error - ${err}` : `Result ${JSON.stringify(result)}`
    ws.send(JSON.stringify({ type: 'deviceLog', content: commandResult }))
  });
}

ws.addEventListener('message', async (event) => {
  const messageText = event.data;
  const message = JSON.parse(messageText);

  console.log(message);

  switch (message.type) {
    case 'webRTCOffer':
      handleOffer(message.offer);
      break;
    case 'ICECandidate':
      handleCandidate(message.candidate);
      break;
    case 'command':
      handleCommand(message.command);
      break;
    default:
      console.error('Unknown message type:', message.type);
      break;
  }
});

pc.onicecandidate = (event) => {
  if (event.candidate) {
    ws.send(JSON.stringify({ type: 'ICECandidate', candidate: event.candidate }));
  }
};
