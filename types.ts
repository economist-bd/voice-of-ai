
export interface ReverbSettings {
  roomSize: number;
  decayTime: number;
  damping: number;
  wetLevel: number;
  dryLevel: number;
  preDelay: number;
}

export interface AudioState {
  isProcessing: boolean;
  isLoaded: boolean;
  isPlaying: boolean;
  fileName: string | null;
  duration: number;
  currentTime: number;
}
