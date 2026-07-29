import React from 'react';
import { Camera, History, Settings, Sparkles } from 'lucide-react';

interface HeaderProps {
  onOpenHistory: () => void;
  onOpenSettings: () => void;
  historyCount: number;
  hasCustomKey: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenHistory,
  onOpenSettings,
  historyCount,
  hasCustomKey,
}) => {
  return (
    <header className="sticky top-0 z-30 bg-slate-950/80 backdrop-blur-md border-b border-slate-800/80 text-white px-6 py-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_10px_#10b981]" />
        <div>
          <h1 className="font-bold text-base tracking-tight text-white flex items-center gap-2">
            FotoRespuesta
            <span className="text-[10px] font-bold tracking-widest text-slate-400 uppercase bg-slate-900 border border-slate-800 px-2 py-0.5 rounded-md">
              AI VISION
            </span>
          </h1>
          <p className="text-[11px] text-slate-500 tracking-wide font-medium">
            Escaneo e identificación instantánea
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2.5">
        <button
          onClick={onOpenHistory}
          className="relative p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white transition-all border border-slate-800/80 active:scale-95 cursor-pointer"
          title="Historial de preguntas"
        >
          <History className="w-4 h-4" />
          {historyCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-emerald-500 text-slate-950 text-[10px] font-extrabold w-4 h-4 rounded-full flex items-center justify-center shadow-sm">
              {historyCount > 9 ? '9+' : historyCount}
            </span>
          )}
        </button>

        <button
          onClick={onOpenSettings}
          className="relative p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white transition-all border border-slate-800/80 active:scale-95 cursor-pointer"
          title="Configuración de IA"
        >
          <Settings className="w-4 h-4" />
          {hasCustomKey && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          )}
        </button>
      </div>
    </header>
  );
};
