import { EventEmitter } from 'events';
import child_process from 'child_process';
import { AudioEncodeStream } from '../lib/multiplayer/public/audio/audio-encode.mjs';
import vad from '@ricky0123/vad-node';
import { log as vadLog } from '@ricky0123/vad-node/dist/_common/logging.js';
import {
  InputDevices,
} from './input-devices.mjs';
import {
  QueueManager,
} from '../util/queue-manager.mjs';

//

const _disableVadLog = () => {
  for (const k in vadLog) {
    vadLog[k] = () => {};
  }
};
_disableVadLog();

//

/* const convertF32I16 = (samples) => {
  const buffer = new ArrayBuffer(samples.length * Int16Array.BYTES_PER_ELEMENT);
  const view = new Int16Array(buffer);
  for (let i = 0; i < samples.length; i++) {
    view[i] = samples[i] * 0x7fff;
  }
  return view;
};

class Mp3EncodeStream extends Transform {
  constructor({
    sampleRate = AudioInput.defaultSampleRate,
    bitRate = 128,
  } = {}) {
    super();

    this.mp3encoder = new lamejs.Mp3Encoder(1, sampleRate, bitRate); // mono
  }
  _transform(chunk, encoding, callback) {
    if (chunk.byteLength % Float32Array.BYTES_PER_ELEMENT !== 0) {
      throw new Error('wrong byte length', chunk.byteLength);
    }
    const float32Array = new Float32Array(chunk.buffer, chunk.byteOffset, chunk.byteLength / Float32Array.BYTES_PER_ELEMENT);
    const samples = convertF32I16(float32Array);
    const encodedData = this.mp3encoder.encodeBuffer(samples);
    this.push(encodedData);

    callback();
  }
  _flush(callback) {
    const encodedData = this.mp3encoder.flush();
    this.push(encodedData);

    callback();
  }
} */

export const encodeMp3 = async (bs, {
  sampleRate,
}) => {
  if (Array.isArray(bs)) {
    bs = bs.slice();
  } else {
    bs = [bs];
  }

  // console.log('got bs', bs);

  let bufferIndex = 0;
  const inputStream = new ReadableStream({
    // start(controller) {
    // },
    pull(controller) {
      // console.log('pull', bufferIndex, bs.length);
      if (bufferIndex < bs.length) {
        const b = bs[bufferIndex++];
        // console.log('enqueue b', b);
        controller.enqueue(b);
      } else {
        controller.close();
      }
    },
  });

  const encodeTransformStream = new AudioEncodeStream({
    type: 'audio/mpeg',
    sampleRate,
    transferBuffers: false,
  });

  const outputStream = inputStream.pipeThrough(encodeTransformStream);

  // read the output
  const outputs = [];
  for await (const output of outputStream) {
    const b = Buffer.from(output.buffer, output.byteOffset, output.byteLength);
    outputs.push(b);
  }
  return Buffer.concat(outputs);
};

//

export class VoiceActivityMicrophoneInput extends EventTarget {
  constructor({
    device,
  }) {
    super();

    this.abortController = new AbortController();
    const {
      signal,
    } = this.abortController;

    this.paused = false;

    (async () => {
      const vadThreshold = 0.2;
      const myvad = await vad.NonRealTimeVAD.new({
        positiveSpeechThreshold: vadThreshold,
        negativeSpeechThreshold: vadThreshold,
      });
      if (signal.aborted) return;

      const sampleRate = AudioInput.defaultSampleRate;
      const numSamples = sampleRate * 0.5; // 0.5 seconds
      const inputDevices = new InputDevices();
      const microphoneInput = inputDevices.getAudioInput(device.id, {
        sampleRate,
        numSamples,
      });
      signal.addEventListener('abort', () => {
        microphoneInput.close();
      });
      this.addEventListener('pause', e => {
        microphoneInput.pause();
      });
      this.addEventListener('resume', e => {
        microphoneInput.resume();
      });

      const onstart = e => {
        this.dispatchEvent(new MessageEvent('start', {
          data: null,
        }));
      };
      microphoneInput.on('start', onstart);
      signal.addEventListener('abort', () => {
        microphoneInput.removeListener('start', onstart);
      });

      const bs = [];
      let lastDetected = false;
      this.addEventListener('pause', e => {
        bs.length = 0;
        lastDetected = false;
      });
      const microphoneQueueManager = new QueueManager();
      const ondata = async (d) => {
        await microphoneQueueManager.waitForTurn(async () => {
          if (this.paused) return;

          // push the buffer
          bs.push(d.slice());

          // check for detection in the current buffer
          const asyncIterator = myvad.run(d, sampleRate);
          let detected = false;
          for await (const vadResult of asyncIterator) {
            if (this.paused) return;
            detected = true;
          }

          // reconcile detected change
          if (detected) {
            if (!lastDetected) {
              // voice is start
              this.dispatchEvent(new MessageEvent('voicestart', {
                data: null,
              }));
            }
          } else {
            if (lastDetected) {
              // voice end
              this.dispatchEvent(new MessageEvent('voice', {
                data: {
                  buffers: bs.slice(),
                  sampleRate,
                },
              }));
              bs.length = 0;
            } else {
              // keep the last buffer
              bs.splice(0, bs.length - 1);
            }
          }
          lastDetected = detected;
        });
      };
      microphoneInput.on('data', ondata);
      signal.addEventListener('abort', () => {
        microphoneInput.removeListener('data', ondata);
      });
    })();
  }
  close() {
    this.abortController.abort();
    this.dispatchEvent(new MessageEvent('close', {
      data: null,
    }));
  }
  pause() {
    if (!this.paused) {
      this.paused = true;
      this.dispatchEvent(new MessageEvent('pause', {
        data: null,
      }));
    }
  }
  resume() {
    if (this.paused) {
      this.paused = false;
      this.dispatchEvent(new MessageEvent('resume', {
        data: null,
      }));
    }
  }
}
//

export class AudioInput extends EventEmitter {
  static defaultSampleRate = 48000;
  constructor(id, {
    sampleRate = AudioInput.defaultSampleRate,
    numSamples,
  } = {}) {
    super();

    const _reset = () => {
      this.abortController = new AbortController();
      const { signal } = this.abortController;

      this.paused = false;

      // ffmpeg -f avfoundation -i ":1" -ar 48000 -c:a libopus -f opus pipe:1
      const cp = child_process.spawn('ffmpeg', [
        '-f', 'avfoundation',
        '-i', `:${id}`,
        '-ar', `${sampleRate}`,
        // '-c:a', 'libopus',
        // '-f', 'opus',
        '-f', 'f32le',
        '-acodec', 'pcm_f32le',
        'pipe:1',
      ]);
      // cp.stderr.pipe(process.stderr);
      signal.addEventListener('abort', () => {
        cp.kill();
      });

      const _listenForStart = () => {
        let s = '';
        cp.stderr.setEncoding('utf8');
        const ondata = data => {
          s += data;
          if (/time=/.test(s)) {
            this.emit('start');
            cp.stderr.removeListener('data', ondata);
          }
        };
        cp.stderr.on('data', ondata);

        signal.addEventListener('abort', () => {
          cp.stderr.removeListener('data', ondata);
        });
      };
      _listenForStart();

      const bs = [];
      let bsLength = 0;
      const ondata = data => {
        if (typeof numSamples === 'number') {
          bs.push(data);
          bsLength += data.length;

          // console.log('bs length', bsLength, numSamples);

          if (bsLength / Float32Array.BYTES_PER_ELEMENT >= numSamples) {
            const b = Buffer.concat(bs);
            let i = 0;
            while (bsLength / Float32Array.BYTES_PER_ELEMENT >= numSamples) {
              // const data = b.slice(i * Float32Array.BYTES_PER_ELEMENT, (i + numSamples) * Float32Array.BYTES_PER_ELEMENT);
              // const samples = new Float32Array(data.buffer, data.byteOffset, numSamples);
              const samples = new Float32Array(b.buffer, b.byteOffset + i * Float32Array.BYTES_PER_ELEMENT, numSamples);
              this.emit('data', samples);

              i += numSamples;
              bsLength -= numSamples * Float32Array.BYTES_PER_ELEMENT;
            }
            // unshift the remainder
            bs.length = 0;
            if (bsLength > 0) {
              bs.push(b.slice(i * Float32Array.BYTES_PER_ELEMENT));
            }
          }
        } else {
          const samples = new Float32Array(data.buffer, data.byteOffset, data.length / Float32Array.BYTES_PER_ELEMENT);
          this.emit('data', samples);
        }
      };
      cp.stdout.on('data', ondata);
      const onend = () => {
        this.emit('end');
      };
      cp.stdout.on('end', onend);
      const onerror = err => {
        this.emit('error', err);
      };
      cp.on('error', onerror);

      signal.addEventListener('abort', () => {
        cp.stdout.removeListener('data', ondata);
        cp.stdout.removeListener('end', onend);
        cp.removeListener('error', onerror);
      });
    };
    _reset();

    this.on('pause', e => {
      this.abortController.abort();
    });
    this.on('resume', e => {
      _reset();
    });
  }
  close() {
    this.abortController.abort();
    this.emit('close');
  }
  pause() {
    if (!this.paused) {
      this.paused = true;
      this.emit('pause');
    }
  }
  resume() {
    if (this.paused) {
      this.paused = false;
      this.emit('resume');
    }
  }
};