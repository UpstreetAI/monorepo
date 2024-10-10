import ortInstance from "onnxruntime-web";
import { log, Message, Silero, defaultFrameProcessorOptions, FrameProcessor, validateOptions } from "./_common/index.js";
import { assetPath } from "./asset-path.js";
import { defaultModelFetcher } from "./default-model-fetcher.js";

import fs from 'fs';

/**
 * Customizable audio constraints for the VAD.
 * Excludes certain constraints that are set for the user by default.
 */

export const ort = ortInstance;
export const defaultRealTimeVADOptions = {
  ...defaultFrameProcessorOptions,
  onFrameProcessed: probabilities => {},
  onVADMisfire: () => {
    log.debug("VAD misfire");
  },
  onSpeechStart: () => {
    log.debug("Detected speech start");
  },
  onSpeechEnd: () => {
    log.debug("Detected speech end");
  },
  workletURL: assetPath("vad.worklet.bundle.min.js"),
  modelURL: assetPath("silero_vad.onnx"),
  modelFetcher: defaultModelFetcher,
  stream: undefined,
  ortConfig: undefined
};
export class MicVAD {
  static async new(options = {}) {
    const fullOptions = {
      ...defaultRealTimeVADOptions,
      ...options
    };
    validateOptions(fullOptions);
    let stream;
    if (fullOptions.stream === undefined) stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        ...fullOptions.additionalAudioConstraints,
        channelCount: 1,
        echoCancellation: true,
        autoGainControl: true,
        noiseSuppression: true
      }
    });else stream = fullOptions.stream;
    const audioContext = new AudioContext();
    const sourceNode = new MediaStreamAudioSourceNode(audioContext, {
      mediaStream: stream
    });
    const audioNodeVAD = await AudioNodeVAD.new(audioContext, fullOptions);
    audioNodeVAD.receive(sourceNode);
    return new MicVAD(fullOptions, audioContext, stream, audioNodeVAD, sourceNode);
  }
  constructor(options, audioContext, stream, audioNodeVAD, sourceNode, listening = false) {
    this.options = options;
    this.audioContext = audioContext;
    this.stream = stream;
    this.audioNodeVAD = audioNodeVAD;
    this.sourceNode = sourceNode;
    this.listening = listening;
  }
  pause = () => {
    this.audioNodeVAD.pause();
    this.listening = false;
  };
  start = () => {
    this.audioNodeVAD.start();
    this.listening = true;
  };
  destroy = () => {
    if (this.listening) {
      this.pause();
    }
    if (this.options.stream === undefined) {
      this.stream.getTracks().forEach(track => track.stop());
    }
    this.sourceNode.disconnect();
    this.audioNodeVAD.destroy();
    this.audioContext.close();
  };
}
export class AudioNodeVAD {
  static async new(ctx, options = {}) {
    const fullOptions = {
      ...defaultRealTimeVADOptions,
      ...options
    };
    validateOptions(fullOptions);
    if (fullOptions.ortConfig !== undefined) {
      fullOptions.ortConfig(ort);
    }
    try {
      await ctx.audioWorklet.addModule(fullOptions.workletURL);
    } catch (e) {
      console.error(`Encountered an error while loading worklet. Please make sure the worklet vad.bundle.min.js included with @ricky0123/vad-web is available at the specified path:
        ${fullOptions.workletURL}
        If need be, you can customize the worklet file location using the \`workletURL\` option.`);
      throw e;
    }
    const vadNode = new AudioWorkletNode(ctx, "vad-helper-worklet", {
      processorOptions: {
        frameSamples: fullOptions.frameSamples
      }
    });
    let model;
    try {
      model = await Silero.new(ort, () => fullOptions.modelFetcher(fullOptions.modelURL));
    } catch (e) {
      console.error(`Encountered an error while loading model file. Please make sure silero_vad.onnx, included with @ricky0123/vad-web, is available at the specified path:
      ${fullOptions.modelURL}
      If need be, you can customize the model file location using the \`modelsURL\` option.`);
      throw e;
    }
    const frameProcessor = new FrameProcessor(model.process, model.reset_state, {
      frameSamples: fullOptions.frameSamples,
      positiveSpeechThreshold: fullOptions.positiveSpeechThreshold,
      negativeSpeechThreshold: fullOptions.negativeSpeechThreshold,
      redemptionFrames: fullOptions.redemptionFrames,
      preSpeechPadFrames: fullOptions.preSpeechPadFrames,
      minSpeechFrames: fullOptions.minSpeechFrames,
      submitUserSpeechOnPause: fullOptions.submitUserSpeechOnPause
    });
    const audioNodeVAD = new AudioNodeVAD(ctx, fullOptions, frameProcessor, vadNode);
    vadNode.port.onmessage = async ev => {
      switch (ev.data?.message) {
        case Message.AudioFrame:
          const buffer = ev.data.data;
          const frame = new Float32Array(buffer);
          await audioNodeVAD.processFrame(frame);
          break;
        default:
          break;
      }
    };
    return audioNodeVAD;
  }
  constructor(ctx, options, frameProcessor, entryNode) {
    this.ctx = ctx;
    this.options = options;
    this.frameProcessor = frameProcessor;
    this.entryNode = entryNode;
  }
  pause = () => {
    const ev = this.frameProcessor.pause();
    this.handleFrameProcessorEvent(ev);
  };
  start = () => {
    this.frameProcessor.resume();
  };
  receive = node => {
    node.connect(this.entryNode);
  };
  processFrame = async frame => {
    const ev = await this.frameProcessor.process(frame);
    this.handleFrameProcessorEvent(ev);
  };
  handleFrameProcessorEvent = ev => {
    if (ev.probs !== undefined) {
      this.options.onFrameProcessed(ev.probs);
    }
    switch (ev.msg) {
      case Message.SpeechStart:
        this.options.onSpeechStart();
        break;
      case Message.VADMisfire:
        this.options.onVADMisfire();
        break;
      case Message.SpeechEnd:
        this.options.onSpeechEnd(ev.audio);
        break;
      default:
        break;
    }
  };
  destroy = () => {
    this.entryNode.port.postMessage({
      message: Message.SpeechStop
    });
    this.entryNode.disconnect();
  };
}

export class StreamVAD {
  constructor() {
    this.loadPromise = this.#load();
  }
  async #load() {
    let model
    try {
      console.log('got ort instance', ort);
      model = await Silero.new(ort, async () => {
        // fullOptions.modelFetcher(fullOptions.modelURL)
        const u = new URL(`../../../silero_vad.onnx`, import.meta.url);
        console.log('loading model from url', u);
        // const res = await fetch(u);
        // const arrayBuffer = await res.arrayBuffer();
        const b = fs.readFileSync(u.pathname);
        const arrayBuffer = b.buffer;
        return arrayBuffer;
      })
    } catch (err) {
      // console.error(
      //   `Encountered an error while loading model file. Please make sure silero_vad.onnx, included with @ricky0123/vad-web, is available at the specified path:
      // ${fullOptions.modelURL}
      // If need be, you can customize the model file location using the \`modelsURL\` option.`
      // )
      console.warn(err);
      throw err
    }

    const fullOptions = {}; // XXX

    const frameProcessor = new FrameProcessor(
      model.process,
      model.reset_state,
      {
        frameSamples: fullOptions.frameSamples,
        positiveSpeechThreshold: fullOptions.positiveSpeechThreshold,
        negativeSpeechThreshold: fullOptions.negativeSpeechThreshold,
        redemptionFrames: fullOptions.redemptionFrames,
        preSpeechPadFrames: fullOptions.preSpeechPadFrames,
        minSpeechFrames: fullOptions.minSpeechFrames,
        submitUserSpeechOnPause: fullOptions.submitUserSpeechOnPause,
      }
    );
  }
  async waitForLoad() {
    await this.loadPromise;
  }
}