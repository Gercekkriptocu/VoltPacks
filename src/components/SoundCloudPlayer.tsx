'use client'
import { useEffect, useRef } from 'react';
import type { ReactElement } from 'react';

// SoundCloud Widget API types
declare global {
  interface Window {
    SC?: {
      Widget: new (element: HTMLIFrameElement) => SCWidget;
    };
  }
}

interface SCWidget {
  bind: (event: string, callback: () => void) => void;
  play: () => void;
  pause: () => void;
  setVolume: (volume: number) => void;
  getVolume: (callback: (volume: number) => void) => void;
  isPaused: (callback: (paused: boolean) => void) => void;
  toggle: () => void;
  load: (url: string, options: Record<string, unknown>) => void;
}

const SOUNDCLOUD_TRACK_URL = 'https://soundcloud.com/kate-bush-official/running-up-that-hill-a-deal-3';

export default function SoundCloudPlayer(): ReactElement {
  const playerRef = useRef<SCWidget | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    // Load SoundCloud Widget API
    const loadSoundCloudAPI = (): void => {
      // Check if API is already loaded
      if (window.SC && window.SC.Widget) {
        initializePlayer();
        return;
      }

      // Load the API script
      const tag = document.createElement('script');
      tag.src = 'https://w.soundcloud.com/player/api.js';
      tag.onload = () => {
        console.log('🎵 SoundCloud API loaded');
        initializePlayer();
      };

      document.body.appendChild(tag);
    };

    const initializePlayer = (): void => {
      if (!window.SC || !iframeRef.current) {
        console.warn('⚠️ SoundCloud API or iframe not ready');
        return;
      }

      console.log('🎬 Initializing SoundCloud player...');

      try {
        playerRef.current = new window.SC.Widget(iframeRef.current);

        // Wait for widget to be ready
        playerRef.current.bind('ready', () => {
          console.log('✅ SoundCloud player ready');
          
          if (!playerRef.current) return;

          // Set volume to 100% and play
          playerRef.current.setVolume(100);
          playerRef.current.play();
          console.log('🎵 Music started playing');
        });

        playerRef.current.bind('finish', () => {
          console.log('🔄 Track finished - replaying...');
          if (playerRef.current) {
            playerRef.current.play();
          }
        });

        // Store player reference globally for MusicPanel
        (window as any).soundcloudPlayer = playerRef.current;
      } catch (err) {
        console.error('❌ Failed to initialize SoundCloud player:', err);
      }
    };

    // User interaction listener for autoplay
    const handleInteraction = (): void => {
      if (playerRef.current) {
        console.log('🖱️ User interaction detected -> Playing Music');
        try {
          playerRef.current.setVolume(100);
          playerRef.current.play();
        } catch (err) {
          console.warn('Play on interaction failed:', err);
        }
        
        // Remove listeners after first interaction
        document.removeEventListener('click', handleInteraction);
        document.removeEventListener('touchstart', handleInteraction);
        document.removeEventListener('mousemove', handleInteraction);
        document.removeEventListener('keydown', handleInteraction);
      }
    };

    // Add interaction listeners
    document.addEventListener('click', handleInteraction, { passive: true });
    document.addEventListener('touchstart', handleInteraction, { passive: true });
    document.addEventListener('mousemove', handleInteraction, { passive: true });
    document.addEventListener('keydown', handleInteraction, { passive: true });

    // Start loading
    loadSoundCloudAPI();

    return () => {
      // Cleanup
      document.removeEventListener('click', handleInteraction);
      document.removeEventListener('touchstart', handleInteraction);
      document.removeEventListener('mousemove', handleInteraction);
      document.removeEventListener('keydown', handleInteraction);
      
      // Clean up global reference
      delete (window as any).soundcloudPlayer;
    };
  }, []);

  return (
    <div style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', opacity: 0, pointerEvents: 'none' }}>
      {/* Hidden SoundCloud player iframe */}
      <iframe
        ref={iframeRef}
        width="100%"
        height="166"
        scrolling="no"
        frameBorder="no"
        allow="autoplay"
        src={`https://w.soundcloud.com/player/?url=${encodeURIComponent(SOUNDCLOUD_TRACK_URL)}&color=%23ff0000&auto_play=true&hide_related=true&show_comments=false&show_user=false&show_reposts=false&show_teaser=false`}
      ></iframe>
    </div>
  );
}
