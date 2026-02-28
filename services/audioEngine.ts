
import { ReverbSettings } from '../types';

export class AudioEngine {
  private context: AudioContext | null = null;
  private offlineContext: OfflineAudioContext | null = null;
  private buffer: AudioBuffer | null = null;

  // Live Nodes
  private liveSource: MediaElementAudioSourceNode | null = null;
  private liveReverb: ConvolverNode | null = null;
  private liveDryGain: GainNode | null = null;
  private liveWetGain: GainNode | null = null;
  private liveFilter: BiquadFilterNode | null = null;
  private liveOutput: GainNode | null = null;

  constructor() {
    this.context = new (window.AudioContext || (window as any).webkitAudioContext)();
  }

  async loadAudio(file: File): Promise<AudioBuffer> {
    const arrayBuffer = await file.arrayBuffer();
    // Use the live context to decode
    this.buffer = await this.context!.decodeAudioData(arrayBuffer);
    return this.buffer;
  }

  // Generate an impulse response for the reverb effect
  public createImpulseResponse(settings: ReverbSettings, context: BaseAudioContext): AudioBuffer {
    const sampleRate = context.sampleRate;
    const length = Math.max(1, Math.floor(sampleRate * settings.decayTime));
    const impulse = context.createBuffer(2, length, sampleRate);

    for (let channel = 0; channel < impulse.numberOfChannels; channel++) {
      const channelData = impulse.getChannelData(channel);
      for (let i = 0; i < length; i++) {
        // Exponential decay combined with noise
        const decay = Math.pow(1 - i / length, settings.roomSize * 3);
        const noise = (Math.random() * 2 - 1) * decay;
        channelData[i] = noise;
      }
    }
    return impulse;
  }

  public setupLiveGraph(audioElement: HTMLMediaElement, settings: ReverbSettings): GainNode {
    if (!this.context) throw new Error("AudioContext not initialized");

    // Close/Disconnect previous nodes if any
    if (this.liveSource) this.liveSource.disconnect();

    this.liveSource = this.context.createMediaElementSource(audioElement);
    this.liveReverb = this.context.createConvolver();
    this.liveDryGain = this.context.createGain();
    this.liveWetGain = this.context.createGain();
    this.liveFilter = this.context.createBiquadFilter();
    this.liveOutput = this.context.createGain();

    // Initial config
    this.updateLiveParameters(settings);

    // Routing
    // Dry Path: Source -> DryGain -> Output
    this.liveSource.connect(this.liveDryGain);
    this.liveDryGain.connect(this.liveOutput);

    // Wet Path: Source -> Filter -> Reverb -> WetGain -> Output
    this.liveSource.connect(this.liveFilter);
    this.liveFilter.connect(this.liveReverb);
    this.liveReverb.connect(this.liveWetGain);
    this.liveWetGain.connect(this.liveOutput);

    // Finally connect output to destination
    this.liveOutput.connect(this.context.destination);

    return this.liveOutput;
  }

  public updateLiveParameters(settings: ReverbSettings) {
    if (!this.context) return;

    if (this.liveDryGain) {
      this.liveDryGain.gain.setTargetAtTime(settings.dryLevel, this.context.currentTime, 0.05);
    }
    if (this.liveWetGain) {
      this.liveWetGain.gain.setTargetAtTime(settings.wetLevel, this.context.currentTime, 0.05);
    }
    if (this.liveFilter) {
      this.liveFilter.type = 'lowpass';
      this.liveFilter.frequency.setTargetAtTime(settings.damping, this.context.currentTime, 0.05);
    }
    if (this.liveReverb) {
      // Swapping convolution buffer is slightly heavy but necessary for room/decay changes
      this.liveReverb.buffer = this.createImpulseResponse(settings, this.context);
    }
  }

  async processAndDownload(settings: ReverbSettings): Promise<Blob> {
    if (!this.buffer) throw new Error("No audio buffer loaded");

    const sampleRate = this.buffer.sampleRate;
    const length = this.buffer.length + Math.floor(sampleRate * settings.decayTime);
    this.offlineContext = new OfflineAudioContext(this.buffer.numberOfChannels, length, sampleRate);

    const offlineSource = this.offlineContext.createBufferSource();
    offlineSource.buffer = this.buffer;

    const offlineReverb = this.offlineContext.createConvolver();
    offlineReverb.buffer = this.createImpulseResponse(settings, this.offlineContext);

    const offlineDryGain = this.offlineContext.createGain();
    const offlineWetGain = this.offlineContext.createGain();
    const offlineFilter = this.offlineContext.createBiquadFilter();

    offlineDryGain.gain.value = settings.dryLevel;
    offlineWetGain.gain.value = settings.wetLevel;
    offlineFilter.type = 'lowpass';
    offlineFilter.frequency.value = settings.damping;

    // Routing
    offlineSource.connect(offlineDryGain);
    offlineDryGain.connect(this.offlineContext.destination);

    offlineSource.connect(offlineFilter);
    offlineFilter.connect(offlineReverb);
    offlineReverb.connect(offlineWetGain);
    offlineWetGain.connect(this.offlineContext.destination);

    offlineSource.start();
    
    const renderedBuffer = await this.offlineContext.startRendering();
    return this.bufferToWav(renderedBuffer);
  }

  private bufferToWav(buffer: AudioBuffer): Blob {
    const length = buffer.length * buffer.numberOfChannels * 2 + 44;
    const bufferArray = new ArrayBuffer(length);
    const view = new DataView(bufferArray);

    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + buffer.length * buffer.numberOfChannels * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, buffer.numberOfChannels, true);
    view.setUint32(24, buffer.sampleRate, true);
    view.setUint32(28, buffer.sampleRate * buffer.numberOfChannels * 2, true);
    view.setUint16(32, buffer.numberOfChannels * 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, buffer.length * buffer.numberOfChannels * 2, true);

    let offset = 44;
    for (let i = 0; i < buffer.length; i++) {
      for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
        const sample = Math.max(-1, Math.min(1, buffer.getChannelData(channel)[i]));
        view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
        offset += 2;
      }
    }

    return new Blob([view], { type: 'audio/wav' });
  }

  getContext() {
    return this.context;
  }
}

export const audioEngine = new AudioEngine();
