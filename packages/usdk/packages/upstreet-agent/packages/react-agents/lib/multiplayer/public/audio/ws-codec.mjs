import {
  FakeAudioData,
} from './ws-codec-util.mjs';

export class OpusAudioEncoder {
  constructor({sampleRate, codecs, output, error}) {
    // this.worker = new OpusCodecWorker();
    // this.worker = new Worker("../../../../util/audio-worker/ws-opus-codec-worker.js");
    if (!codecs.WsOpusCodec) {
      throw new Error('no WsOpusCodec');
    }
    this.worker = new codecs.WsOpusCodec();
    // console.log("worker", this.worker)
    this.worker.addEventListener('message', e => {
      output(e.data);
    });
    this.worker.addEventListener('error', error);
    this.worker.postMessage({
      mode: 'encode',
      sampleRate,
    });
  }

  encode(audioData) {
    this.worker.postMessage(audioData.data, audioData.data !== null ? [audioData.data.buffer] : []);
  }

  close() {
    this.worker.terminate();
  }
}

export class OpusAudioDecoder {
  constructor({sampleRate, format, codecs, output, error}) {
    // this.worker = new OpusCodecWorker();
    // this.worker = new Worker("../../../../util/audio-worker/ws-opus-codec-worker.js");
    if (!codecs.WsOpusCodec) {
      throw new Error('no WsOpusCodec');
    }
    this.worker = new codecs.WsOpusCodec();
    const fakeAudioData = new FakeAudioData();
    this.worker.addEventListener('message', e => {
      if (e.data.data) {
        fakeAudioData.set(e.data.data);
        output(fakeAudioData);
      } else {
        output(null);
      }
    });
    this.worker.addEventListener('error', error);
    this.worker.postMessage({
      mode: 'decode',
      sampleRate,
      format,
    });
  }

  decode(data) {
    this.worker.postMessage(data, data !== null ? [data.buffer] : []);
  }
}

export class Mp3AudioEncoder {
  constructor({
    sampleRate,
    bitrate = 128,
    transferBuffers = true,
    codecs,
    output,
    error,
  }) {
    if (!sampleRate) {
      debugger;
    }

    this.transferBuffers = transferBuffers;

    // this.worker = new Worker(new URL('../audio-worker/ws-mp3-encoder-worker.mjs', import.meta.url), {
    //   type: 'module',
    // });
    if (!codecs.WsMp3Encoder) {
      console.warn('no WsMp3Encoder', codecs);
      throw new Error('no WsMp3Encoder');
    }
    this.worker = new codecs.WsMp3Encoder();

    this.worker.addEventListener('message', e => {
      output(e.data);
    });
    this.worker.addEventListener('error', error);
    this.worker.postMessage({
      sampleRate,
      bitrate,
    });
  }
  
  encode(audioData) {
    this.worker.postMessage(audioData.data, this.transferBuffers && audioData.data !== null ? [audioData.data.buffer] : []);
  }

  close() {
    this.worker.terminate();
  }
}

export class Mp3AudioDecoder {
  constructor({
    sampleRate,
    format,
    transferBuffers = true,
    codecs,
    output,
    error,
  }) {
    if (!sampleRate) {
      throw new Error('no sample rate');
    }
    if (!codecs) {
      throw new Error('no codecs');
    }

    this.transferBuffers = transferBuffers;

    // this.worker = new Worker(new URL('../audio-worker/ws-mp3-decoder-worker.mjs', import.meta.url), {
    //   type: 'module',
    // });
    this.worker = new codecs.WsMp3Decoder();

    const fakeAudioData = new FakeAudioData();
    this.worker.addEventListener('message', e => {
      // console.log('worker got data', e.data);
      if (e.data.data) {
        fakeAudioData.set(e.data.data);
        output(fakeAudioData);
      } else {
        output(null);
      }
    });
    this.worker.addEventListener('error', error);
    this.worker.postMessage({
      sampleRate,
      format,
    });
  }

  decode(data) {
    this.worker.postMessage(data, this.transferBuffers && data !== null ? [data.buffer] : []);
  }

  close() {
    this.worker.terminate();
  }
}