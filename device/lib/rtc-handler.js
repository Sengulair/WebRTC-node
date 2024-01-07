const { Transform, Readable } = require("node:stream");
const { RTCPeerConnection, nonstandard, MediaStream } = require("wrtc");
const recorder = require("node-record-lpcm16");
const Speaker = require("speaker");
const audioConfig = {
    sampleRate: 48000,
    channels: 1,
    bitDepth: 16,
};

const WEBRTC_AUDIO_FRAME_IN_SEC = 0.01;
const BIT_IN_BYTE = 8;

class RtcHandler {
    static #resempleMonoToStereo(samples) {
        const monoBuffer = Buffer.from(samples.buffer);
        const stereoBuffer = Buffer.alloc(monoBuffer.length * 2);

        for (let i = 0; i < monoBuffer.length / 2; i++) {
            const sample = monoBuffer.readUInt16LE(i * 2);
            stereoBuffer.writeUInt16LE(sample, i * 4);
            stereoBuffer.writeUInt16LE(sample, i * 4 + 2);
        }

        return stereoBuffer;
    }

    static #createChunker(size) {
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
            },
        });
    }

    constructor(deviceOut, deviceIn, callbackMessage, logger) {
        var self = this;
        this.logger = logger;
        this.logger.debug(`Initiating RTC`);
        this.logger.debug(`Interface '${deviceOut}' will be used for output`);
        this.logger.debug(`Interface '${deviceIn}' will be used for input`);

        this.recording = recorder.record({
            recorder: "sox",
            sampleRate: audioConfig.sampleRate,
            channels: audioConfig.channels,
            device: deviceIn,
        });
        this.speaker = new Speaker({
            channels: 2,
            bitDepth: audioConfig.bitDepth,
            sampleRate: audioConfig.sampleRate,
            device: deviceOut,
        });

        this.recordingStream = this.recording.stream();

        this.pc = new RTCPeerConnection(null);

        this.audioChunker = RtcHandler.#createChunker(
            (audioConfig.bitDepth / BIT_IN_BYTE) *
                audioConfig.sampleRate *
                WEBRTC_AUDIO_FRAME_IN_SEC *
                audioConfig.channels
        );
        this.recordingStream.pipe(this.audioChunker);

        const audioSource = new nonstandard.RTCAudioSource();
        this.audioTrack = audioSource.createTrack();

        this.audioChunker.on("data", (data) => {
            const frame = {
                bitsPerSample: audioConfig.bitDepth,
                sampleRate: audioConfig.sampleRate,
                channelCount: audioConfig.channels,
                numberOfFrames:
                    audioConfig.sampleRate * WEBRTC_AUDIO_FRAME_IN_SEC,
                samples: new Int16Array(new Uint8Array(data).buffer),
            };
            audioSource.onData(frame);
        });

        this.pc.addTrack(this.audioTrack, new MediaStream());

        this.pc.ontrack = function (event) {
            if (event.track.kind === "audio") {
                const audioTrack = event.track;

                const sink = new nonstandard.RTCAudioSink(audioTrack);

                const readable = new Readable({
                    read() {},
                });

                readable.pipe(self.speaker);

                sink.ondata = (data) => {
                    const stereoBuffer = RtcHandler.#resempleMonoToStereo(
                        data.samples
                    );

                    readable.push(stereoBuffer);
                };
            }
        };

        this.pc.onicecandidate = (event) => {
            if (!event.candidate) return;
            callbackMessage('ice-candidate', event.candidate);
        };
    }

    async offer(offer) {
        await this.pc.setRemoteDescription(offer);
        const answer = await this.pc.createAnswer();
        await this.pc.setLocalDescription(answer);
        return this.pc.localDescription;
    }

    async addIceCandidate(candidate) {
        if (!candidate || !candidate.candidate) return;
        await this.pc.addIceCandidate(candidate);
    }

    close() {
        this.logger.debug(`Closing RTC`);
        this.pc.close();
        this.speaker.close();
        this.recording.stop();
    }
}

module.exports = RtcHandler;