
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import { ReverbSettings, AudioState } from './types';
import { audioEngine } from './services/audioEngine';
import ReverbControl from './components/ReverbControl';
import Visualizer from './components/Visualizer';

const App: React.FC = () => {
  const [settings, setSettings] = useState<ReverbSettings>({
    roomSize: 0.5,
    decayTime: 2.0,
    damping: 1000,
    wetLevel: 0.4,
    dryLevel: 0.8,
    preDelay: 0.05,
  });

  const [audioState, setAudioState] = useState<AudioState & { previewUrl: string | null }>({
    isProcessing: false,
    isLoaded: false,
    isPlaying: false,
    fileName: null,
    duration: 0,
    currentTime: 0,
    previewUrl: null,
  });

  const [aiTip, setAiTip] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [outputNode, setOutputNode] = useState<GainNode | null>(null);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (audioState.previewUrl) URL.revokeObjectURL(audioState.previewUrl);
    setOutputNode(null);
    
    setAudioState(prev => ({ 
      ...prev, 
      isProcessing: true, 
      previewUrl: null, 
      fileName: file.name,
      isPlaying: false,
      currentTime: 0,
      duration: 0
    }));
    
    try {
      await audioEngine.loadAudio(file);
      const url = URL.createObjectURL(file);
      setAudioState(prev => ({ ...prev, isLoaded: true, isProcessing: false, previewUrl: url }));
      getAiStudioTip(file.name);
    } catch (error) {
      console.error("Audio loading failed", error);
      alert("অডিও ফাইল লোড করতে সমস্যা হয়েছে।");
      setAudioState(prev => ({ ...prev, isProcessing: false }));
    }
  };

  const getAiStudioTip = async (fileName: string) => {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `I am using a Studio Reverb tool for the file: ${fileName}. Give me one short, professional "Producer Tip" in Bengali for mixing vocals with reverb like Fruity Reeverb 2. Keep it under 20 words.`,
      });
      setAiTip(response.text || null);
    } catch (e) {
      console.error("AI Tip Error", e);
    }
  };

  const handleTogglePlay = () => {
    if (!audioRef.current || !audioState.previewUrl) return;

    const ctx = audioEngine.getContext();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume();
    }

    // Initialize live graph if not already done
    if (!outputNode && ctx && audioRef.current) {
      const liveOutput = audioEngine.setupLiveGraph(audioRef.current, settings);
      setOutputNode(liveOutput);
    }

    if (audioState.isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
  };

  const handleDownload = async () => {
    setAudioState(prev => ({ ...prev, isProcessing: true }));
    try {
      const blob = await audioEngine.processAndDownload(settings);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Studio_Reverb_${audioState.fileName || 'audio'}.wav`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Download processing failed", error);
      alert("ফাইল প্রসেসিং ব্যর্থ হয়েছে।");
    } finally {
      setAudioState(prev => ({ ...prev, isProcessing: false }));
    }
  };

  const updateSetting = (key: keyof ReverbSettings, val: number) => {
    const newSettings = { ...settings, [key]: val };
    setSettings(newSettings);
    // Real-time update of live nodes
    audioEngine.updateLiveParameters(newSettings);
  };

  const progressPercent = audioState.duration > 0 
    ? (audioState.currentTime / audioState.duration) * 100 
    : 0;

  return (
    <div className="min-h-screen flex flex-col items-center p-4 md:p-8 space-y-8 bg-slate-950 text-slate-100">
      <header className="text-center space-y-2 max-w-2xl">
        <h1 className="text-4xl md:text-6xl font-black bg-gradient-to-r from-emerald-400 to-cyan-500 bg-clip-text text-transparent italic tracking-tighter">
          STUDIO REVERB PRO
        </h1>
        <p className="text-slate-400 text-sm md:text-base font-medium px-4">
          আপনার ভয়েসকে দিন একবারে প্রফেশনাল স্টুডিওর মতো রিভার্ব ইফেক্ট। ১০০% রিয়েল-টাইম প্রিভিউ।
        </p>
      </header>

      <main className="w-full max-w-4xl bg-slate-900/50 border border-slate-800 rounded-3xl p-6 md:p-10 shadow-2xl backdrop-blur-xl relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-1 bg-emerald-500/30 blur-xl"></div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          <div className="space-y-6">
            <div className="bg-black/40 p-4 rounded-2xl border border-slate-800">
              <div className="flex justify-between items-center mb-4">
                <span className="text-xs font-bold text-emerald-500 uppercase tracking-widest flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full bg-emerald-500 ${audioState.isPlaying ? 'animate-ping' : ''}`}></div>
                  {audioState.isPlaying ? 'LIVE PREVIEW' : 'READY'}
                </span>
                {audioState.fileName && (
                   <span className="text-[10px] text-slate-500 truncate max-w-[150px]">
                     {audioState.fileName}
                   </span>
                )}
              </div>
              
              <Visualizer audioContext={audioEngine.getContext()} sourceNode={outputNode} />
              
              {audioState.previewUrl && (
                <div className="mt-4 flex items-center justify-center gap-4">
                   <button 
                    onClick={handleTogglePlay}
                    className="p-3 bg-emerald-500 rounded-full hover:bg-emerald-400 transition-colors text-slate-950 shadow-lg shadow-emerald-500/20"
                    aria-label={audioState.isPlaying ? "Pause" : "Play"}
                   >
                    {audioState.isPlaying ? (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    )}
                   </button>
                   <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-emerald-500 transition-all duration-100" 
                        style={{ width: `${progressPercent}%` }}
                      ></div>
                   </div>
                   <span className="text-[10px] font-mono text-slate-400 min-w-[60px] text-right">
                     {Math.floor(audioState.currentTime)}s / {Math.floor(audioState.duration)}s
                   </span>
                </div>
              )}
            </div>

            <audio 
              ref={audioRef}
              src={audioState.previewUrl || ''}
              onPlay={() => setAudioState(p => ({ ...p, isPlaying: true }))}
              onPause={() => setAudioState(p => ({ ...p, isPlaying: false }))}
              onEnded={() => setAudioState(p => ({ ...p, isPlaying: false, currentTime: 0 }))}
              onTimeUpdate={(e) => {
                const currentTime = e.currentTarget.currentTime;
                setAudioState(p => ({ ...p, currentTime }));
              }}
              onLoadedMetadata={(e) => {
                const duration = e.currentTarget.duration;
                setAudioState(p => ({ ...p, duration }));
              }}
              className="hidden"
            />

            <div className="flex flex-col space-y-4">
              <button 
                onClick={() => fileInputRef.current?.click()}
                disabled={audioState.isProcessing}
                className="w-full py-4 px-6 bg-slate-100 text-slate-950 font-bold rounded-xl hover:bg-emerald-400 transition-all flex items-center justify-center gap-3 active:scale-[0.98] disabled:opacity-50 shadow-lg shadow-white/5"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                নতুন ফাইল আপলোড করুন
              </button>
              <input 
                ref={fileInputRef}
                type="file" 
                accept="audio/*" 
                className="hidden" 
                onChange={handleFileUpload} 
              />

              {aiTip && (
                <div className="p-3 bg-emerald-900/20 border border-emerald-500/30 rounded-lg text-xs text-emerald-400 flex gap-2 items-start italic">
                  <span className="text-base">💡</span>
                  <p className="leading-relaxed">{aiTip}</p>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <ReverbControl label="Room Size" value={settings.roomSize} min={0.1} max={1.0} step={0.05} onChange={(v) => updateSetting('roomSize', v)} />
            <ReverbControl label="Decay Time" value={settings.decayTime} min={0.5} max={10.0} step={0.1} unit="s" onChange={(v) => updateSetting('decayTime', v)} />
            <ReverbControl label="Dry Level" value={settings.dryLevel} min={0} max={1.0} step={0.05} onChange={(v) => updateSetting('dryLevel', v)} />
            <ReverbControl label="Wet Level" value={settings.wetLevel} min={0} max={1.0} step={0.05} onChange={(v) => updateSetting('wetLevel', v)} />
            <ReverbControl label="Pre-Delay" value={settings.preDelay} min={0} max={0.5} step={0.01} unit="ms" onChange={(v) => updateSetting('preDelay', v)} />
            <ReverbControl label="High Cut" value={settings.damping} min={100} max={20000} step={100} unit="Hz" onChange={(v) => updateSetting('damping', v)} />
          </div>
        </div>

        <div className="mt-10 pt-8 border-t border-slate-800 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="text-slate-500 text-xs flex items-center gap-4">
            <div className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-slate-600"></div>
              <span>Stereo 44.1kHz</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-slate-600"></div>
              <span>24-bit WAV</span>
            </div>
          </div>

          <button 
            onClick={handleDownload}
            disabled={!audioState.isLoaded || audioState.isProcessing}
            className="group relative inline-flex items-center justify-center px-10 py-4 font-bold text-white transition-all duration-200 bg-emerald-600 font-pj rounded-xl focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed overflow-hidden shadow-lg shadow-emerald-900/20 active:scale-95"
          >
             <span className="relative flex items-center gap-2">
               {audioState.isProcessing ? 'প্রসেসিং হচ্ছে...' : 'প্রসেস ও সেভ করুন'}
               {!audioState.isProcessing && (
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
               )}
             </span>
          </button>
        </div>
      </main>

      <footer className="text-slate-600 text-[10px] md:text-xs text-center pb-8 space-y-1">
        <p>ব্যক্তিগত ব্যবহারের জন্য তৈরি। আপনার সব ডাটা ব্রাউজারেই থাকে, সার্ভারে কিছু আপলোড হয় না।</p>
        <p>© 2024 Studio Reverb Pro | Powered by Gemini 3</p>
      </footer>
    </div>
  );
};

export default App;
