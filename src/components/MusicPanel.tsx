'use client'
import { useState, useRef, useEffect } from 'react';
import type { ReactElement } from 'react';

// SoundCloud Widget interface
interface SCWidget {
  play: () => void;
  pause: () => void;
  setVolume: (volume: number) => void;
  getVolume: (callback: (volume: number) => void) => void;
  isPaused: (callback: (paused: boolean) => void) => void;
  toggle: () => void;
}

export default function MusicPanel(): ReactElement {
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const playerRef = useRef<SCWidget | null>(null);

  // Get SoundCloud player reference
  useEffect(() => {
    const findPlayer = (): void => {
      const player = (window as any).soundcloudPlayer as SCWidget | undefined;
      if (player) {
        playerRef.current = player;
        console.log('🎵 Music panel connected to SoundCloud player');
      } else {
        setTimeout(findPlayer, 200);
      }
    };

    const timeout = setTimeout(findPlayer, 500);

    return () => {
      clearTimeout(timeout);
    };
  }, []);

  const toggleMute = (): void => {
    if (!playerRef.current) {
      console.warn('⚠️ SoundCloud player not ready');
      return;
    }

    try {
      if (isMuted) {
        // Unmute
        playerRef.current.setVolume(100);
        playerRef.current.play();
        setIsMuted(false);
        console.log('🔊 Unmuted - volume set to 100%');
      } else {
        // Mute
        playerRef.current.setVolume(0);
        setIsMuted(true);
        console.log('🔇 Muted');
      }
    } catch (err) {
      console.error('❌ Failed to toggle mute:', err);
    }
  };

  return (
    <div className="fixed bottom-3 right-3 z-50">
      {/* Simple mute/unmute button */}
      <button
        onClick={toggleMute}
        className="w-10 h-10 rounded-full bg-red-900/80 hover:bg-red-800 border-2 border-red-600 text-white shadow-[0_0_16px_rgba(231,29,54,0.6)] hover:shadow-[0_0_24px_rgba(231,29,54,0.9)] transition-all duration-300 flex items-center justify-center text-xl backdrop-blur-sm"
        title={isMuted ? 'Unmute Music' : 'Mute Music'}
      >
        {isMuted ? '🔇' : '🔊'}
      </button>
    </div>
  );
}
