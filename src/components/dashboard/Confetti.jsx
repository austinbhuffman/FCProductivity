import React, { useEffect, useState } from "react";

const COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#8b5cf6", "#ec4899", "#14b8a6"];

function ConfettiPiece({ style }) {
  return (
    <div
      className="absolute w-3 h-3 opacity-90"
      style={{
        ...style,
        backgroundColor: COLORS[Math.floor(Math.random() * COLORS.length)],
        borderRadius: Math.random() > 0.5 ? "50%" : "0%",
        transform: `rotate(${Math.random() * 360}deg)`,
      }}
    />
  );
}

export default function Confetti({ show, onComplete }) {
  const [pieces, setPieces] = useState([]);

  useEffect(() => {
    if (!show) {
      setPieces([]);
      return;
    }

    // Play celebration sound using Web Audio API
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const playNote = (freq, startTime, duration) => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        oscillator.frequency.value = freq;
        oscillator.type = "square";
        gainNode.gain.setValueAtTime(0.3, startTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
        oscillator.start(startTime);
        oscillator.stop(startTime + duration);
      };
      // Fanfare melody
      const now = audioContext.currentTime;
      playNote(523, now, 0.15);        // C
      playNote(659, now + 0.15, 0.15); // E
      playNote(784, now + 0.3, 0.15);  // G
      playNote(1047, now + 0.45, 0.4); // High C
    } catch (e) {
      console.log("Audio not supported");
    }

    const newPieces = [];
    for (let i = 0; i < 1000; i++) {
      newPieces.push({
        id: i,
        left: `${Math.random() * 100}%`,
        animationDelay: `${Math.random() * 0.5}s`,
        animationDuration: `${2 + Math.random() * 2}s`,
      });
    }
    setPieces(newPieces);

    const timer = setTimeout(() => {
      if (onComplete) onComplete();
    }, 4000);

    return () => clearTimeout(timer);
  }, [show, onComplete]);

  if (!show || pieces.length === 0) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      <style>{`
        @keyframes confetti-fall {
          0% {
            transform: translateY(-10px) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(720deg);
            opacity: 0;
          }
        }
        .confetti-piece {
          animation: confetti-fall linear forwards;
        }
      `}</style>
      {pieces.map((piece) => (
        <ConfettiPiece
          key={piece.id}
          style={{
            left: piece.left,
            top: "-10px",
            animationDelay: piece.animationDelay,
            animationDuration: piece.animationDuration,
            animationName: "confetti-fall",
            animationTimingFunction: "linear",
            animationFillMode: "forwards",
          }}
        />
      ))}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-8 text-center animate-bounce">
          <div className="text-6xl mb-4">🎉</div>
          <h2 className="text-3xl font-bold text-emerald-600 mb-2">Goal Achieved!</h2>
          <p className="text-slate-600">Monthly collection goal of $20,000 reached!</p>
        </div>
      </div>
    </div>
  );
}