'use client'

import { useEffect } from 'react'

export function ReadyNotifier() {
  useEffect(() => {
    // Send ready signal to parent when mini-app is fully loaded
    window.parent.postMessage({
      type: 'OHARA_MINIAPP_READY',
      timestamp: Date.now(),
      version: '1.0'
    }, '*');
  }, []);

  return null;
}

