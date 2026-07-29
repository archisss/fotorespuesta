import React, { useState, useEffect } from 'react';
import { Sparkles, Camera, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';

interface LoadingStateProps {
  capturedImage?: string | null;
}

const steps = [
  'Escaneando texto de la pregunta...',
  'Analizando opciones de respuesta...',
  'Calculando solución exacta con IA...',
  'Preparando respuesta inmediata...',
];

export const LoadingState: React.FC<LoadingStateProps> = ({ capturedImage }) => {
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setStepIndex((prev) => (prev + 1) % steps.length);
    }, 1200);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full max-w-xl mx-auto flex flex-col items-center justify-center min-h-[60vh] p-6 text-center space-y-6">
      {/* Photo Preview Thumbnail with Scanner beam */}
      <div className="relative w-48 h-48 sm:w-56 sm:h-56 rounded-3xl overflow-hidden border-2 border-emerald-500/60 bg-slate-950 shadow-2xl shadow-emerald-500/20 flex items-center justify-center">
        {capturedImage ? (
          <img
            src={capturedImage}
            alt="Foto capturada"
            className="w-full h-full object-cover brightness-90"
          />
        ) : (
          <Camera className="w-16 h-16 text-slate-700" />
        )}

        {/* Scanning laser beam effect */}
        <motion.div
          animate={{ top: ['0%', '100%', '0%'] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'linear' }}
          className="absolute left-0 right-0 h-1 bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 shadow-[0_0_15px_#34d399]"
        />

        <div className="absolute inset-0 bg-emerald-500/10 backdrop-blur-[1px]" />
      </div>

      {/* Loading Spinner & Status message */}
      <div className="space-y-3 max-w-xs">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Obteniendo respuesta</span>
        </div>

        <motion.p
          key={stepIndex}
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -5 }}
          className="text-slate-200 font-semibold text-base"
        >
          {steps[stepIndex]}
        </motion.p>

        <p className="text-slate-400 text-xs">
          Tomará solo un par de segundos...
        </p>
      </div>
    </div>
  );
};
