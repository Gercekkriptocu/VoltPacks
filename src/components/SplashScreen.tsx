"use client";

import { useEffect, useState } from "react";

interface SplashScreenProps {
  finishLoading: () => void; // Yükleme bitince çağrılacak fonksiyon
}

export default function SplashScreen({ finishLoading }: SplashScreenProps) {
  const [isMounted, setIsMounted] = useState(true);
  const [fadeClass, setFadeClass] = useState("opacity-100");

  useEffect(() => {
    // 1. Adım: 3 saniye bekle (Intro Animasyonu)
    const timeout = setTimeout(() => {
      // 2. Adım: Ekranı yavaşça karart (Fade Out)
      setFadeClass("opacity-0 transition-opacity duration-1000 ease-in-out");
      
      // 3. Adım: Animasyon bitince DOM'dan kaldır ve ana sayfayı göster
      setTimeout(() => {
        setIsMounted(false);
        finishLoading();
      }, 1000); // Fade out süresi kadar bekle
    }, 3500); // Toplam splash süresi

    return () => clearTimeout(timeout);
  }, [finishLoading]);

  if (!isMounted) return null;

  return (
    <div className={`fixed inset-0 z-[9999] bg-black flex flex-col items-center justify-center overflow-hidden ${fadeClass}`}>
      
      {/* --- KATMAN 1: CRT TV EFEKTLERİ --- */}
      {/* Scanlines (Tarama Çizgileri) */}
      <div className="absolute inset-0 z-20 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_4px,6px_100%]"></div>
      {/* Noise (Kumlama) */}
      <div className="absolute inset-0 z-10 pointer-events-none opacity-[0.08] bg-[url('https://upload.wikimedia.org/wikipedia/commons/7/76/Noise_tv.png')] animate-grain"></div>
      {/* Vignette (Kenar Karartma) */}
      <div className="absolute inset-0 z-20 pointer-events-none bg-[radial-gradient(circle_at_center,transparent_50%,#000000_100%)]"></div>

      {/* --- KATMAN 2: ARKA PLAN ATMOSFERİ --- */}
      <div className="absolute inset-0 flex items-center justify-center opacity-40">
         <div className="w-[200%] h-[200%] bg-[radial-gradient(circle,#4a0000_0%,transparent_60%)] animate-pulse-slow"></div>
      </div>

      {/* --- KATMAN 3: LOGO & TYPOGRAPHY --- */}
      <div className="relative z-30 transform scale-75 md:scale-100">
        <div className="relative group">
            {/* Logo Arkasındaki Kırmızı Glow */}
            <div className="absolute -inset-10 bg-red-600/20 blur-[60px] animate-pulse"></div>
            
            {/* ANA BAŞLIK: STRANGER PACKS */}
            <h1 className="text-6xl md:text-9xl font-extrabold text-transparent bg-clip-text bg-transparent tracking-tighter"
                style={{ 
                    fontFamily: 'ITC Benguiat, serif',
                    WebkitTextStroke: '2px #e11d48', // Kırmızı kontür
                    textShadow: '0 0 20px rgba(225, 29, 72, 0.8), 0 0 40px rgba(225, 29, 72, 0.4)'
                }}>
                <span className="inline-block animate-zoom-in">STRANGER</span>
                <br />
                <span className="inline-block animate-zoom-in delay-500 mt-2 md:mt-4 text-center w-full">PACKS</span>
            </h1>
            
            {/* Üst ve Alt Çizgiler (Intro Stili) */}
            <div className="absolute top-0 left-0 w-full h-[2px] bg-red-600 shadow-[0_0_15px_red] animate-width-expand"></div>
            <div className="absolute bottom-2 left-0 w-full h-[2px] bg-red-600 shadow-[0_0_15px_red] animate-width-expand delay-300"></div>
        </div>
      </div>

      {/* --- KATMAN 4: LOADING GÖSTERGESİ --- */}
      <div className="absolute bottom-20 z-30 flex flex-col items-center gap-4">
         {/* Dönen Radar / Portal */}
         <div className="w-12 h-12 border-2 border-red-900/50 border-t-red-500 rounded-full animate-spin shadow-[0_0_20px_rgba(255,0,0,0.4)]"></div>
         
         {/* Loading Text */}
         <p className="text-red-500/80 font-mono text-xs tracking-[0.5em] animate-pulse uppercase">
            Connecting to Hawkins...
         </p>
      </div>

      {/* --- CSS ANIMASYONLARI --- */}
      <style jsx>{`
        @keyframes zoom-in {
            0% { transform: scale(30); opacity: 0; letter-spacing: 1em; }
            100% { transform: scale(1); opacity: 1; letter-spacing: normal; }
        }
        .animate-zoom-in {
            animation: zoom-in 2.5s cubic-bezier(0.25, 1, 0.5, 1) forwards;
        }
        
        @keyframes width-expand {
            0% { width: 0%; opacity: 0; left: 50%; }
            100% { width: 100%; opacity: 1; left: 0%; }
        }
        .animate-width-expand {
            animation: width-expand 2s ease-out forwards;
        }

        @keyframes grain {
            0%, 100% { transform: translate(0, 0); }
            10% { transform: translate(-5%, -10%); }
            20% { transform: translate(-15%, 5%); }
            30% { transform: translate(7%, -25%); }
            40% { transform: translate(-5%, 25%); }
            50% { transform: translate(-15%, 10%); }
            60% { transform: translate(15%, 0%); }
            70% { transform: translate(0%, 15%); }
            80% { transform: translate(3%, 35%); }
            90% { transform: translate(-10%, 10%); }
        }
        .animate-grain {
            animation: grain 8s steps(10) infinite;
        }
      `}</style>
    </div>
  );
}
