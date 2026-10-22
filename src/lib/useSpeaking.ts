import { useEffect, useRef, useState } from 'react';

const THRESHOLD = 0.015; // RMS level that counts as speech
const HOLD_MS = 350; // keep the ring on briefly between words

interface Meter {
  source: MediaStreamAudioSourceNode;
  analyser: AnalyserNode;
  lastHeard: number;
}

let sharedContext: AudioContext | null = null;

function audioContext(): AudioContext {
  sharedContext ??= new AudioContext();
  return sharedContext;
}

/** Returns the ids whose stream is currently above the speaking threshold. */
export function useSpeaking(streams: Record<string, MediaStream>): Set<string> {
  const [speaking, setSpeaking] = useState<Set<string>>(() => new Set());
  const meters = useRef(new Map<string, Meter & { stream: MediaStream }>());

  // Keep one analyser per stream.
  useEffect(() => {
    const ctx = audioContext();
    for (const [id, meter] of meters.current) {
      if (streams[id] !== meter.stream) {
        meter.source.disconnect();
        meters.current.delete(id);
      }
    }
    for (const [id, stream] of Object.entries(streams)) {
      if (meters.current.has(id) || stream.getAudioTracks().length === 0) continue;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      meters.current.set(id, { stream, source, analyser, lastHeard: 0 });
    }
  }, [streams]);

  // Poll levels; browsers start the AudioContext suspended until the first interaction.
  useEffect(() => {
    const ctx = audioContext();
    const resume = () => ctx.state === 'suspended' && ctx.resume();
    resume();
    window.addEventListener('pointerdown', resume);

    const buffer = new Float32Array(512);
    const timer = setInterval(() => {
      const now = performance.now();
      const next = new Set<string>();
      for (const [id, meter] of meters.current) {
        meter.analyser.getFloatTimeDomainData(buffer);
        let sum = 0;
        for (const v of buffer) sum += v * v;
        if (Math.sqrt(sum / buffer.length) > THRESHOLD) meter.lastHeard = now;
        if (now - meter.lastHeard < HOLD_MS) next.add(id);
      }
      setSpeaking(prev => (prev.size === next.size && [...next].every(id => prev.has(id)) ? prev : next));
    }, 100);

    const current = meters.current;
    return () => {
      clearInterval(timer);
      window.removeEventListener('pointerdown', resume);
      current.forEach(meter => meter.source.disconnect());
      current.clear();
    };
  }, []);

  return speaking;
}
