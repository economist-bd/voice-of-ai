
import React, { useEffect, useRef } from 'react';

interface VisualizerProps {
  audioContext: AudioContext | null;
  sourceNode: AudioNode | null;
}

const Visualizer: React.FC<VisualizerProps> = ({ audioContext, sourceNode }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(null);
  const analyzerRef = useRef<AnalyserNode | null>(null);

  useEffect(() => {
    if (!audioContext || !sourceNode || !canvasRef.current) return;

    // Create analyzer only if needed
    if (!analyzerRef.current) {
      analyzerRef.current = audioContext.createAnalyser();
      analyzerRef.current.fftSize = 256;
    }

    const analyzer = analyzerRef.current;
    
    // Connect source to analyzer for visualization
    try {
      sourceNode.connect(analyzer);
    } catch (e) {
      console.warn("Could not connect source to visualizer", e);
    }

    const bufferLength = analyzer.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const ctx = canvasRef.current.getContext('2d');

    const draw = () => {
      if (!ctx || !canvasRef.current) return;
      const width = canvasRef.current.width;
      const height = canvasRef.current.height;

      animationRef.current = requestAnimationFrame(draw);
      analyzer.getByteFrequencyData(dataArray);

      ctx.fillStyle = 'rgb(15, 23, 42)';
      ctx.fillRect(0, 0, width, height);

      const barWidth = (width / bufferLength) * 2.5;
      let barHeight;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        barHeight = (dataArray[i] / 255) * height;

        const r = 50 + (barHeight / height) * 200;
        const g = 250 - (barHeight / height) * 100;
        const b = 50;

        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(x, height - barHeight, barWidth, barHeight);

        x += barWidth + 1;
      }
    };

    draw();

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      try {
        sourceNode.disconnect(analyzer);
      } catch (e) {
        // Source might already be disconnected or context closed
      }
    };
  }, [audioContext, sourceNode]);

  return (
    <canvas 
      ref={canvasRef} 
      className="w-full h-32 rounded-lg bg-slate-900 border border-slate-700 shadow-inner"
      width={600}
      height={150}
    />
  );
};

export default Visualizer;
