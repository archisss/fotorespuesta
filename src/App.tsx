import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { CameraScanner } from './components/CameraScanner';
import { AnswerCard } from './components/AnswerCard';
import { LoadingState } from './components/LoadingState';
import { HistoryDrawer } from './components/HistoryDrawer';
import { SettingsModal } from './components/SettingsModal';
import { QuestionResult, AppSettings, AnswerApiResponse } from './types';
import { AlertCircle, Camera, RefreshCw } from 'lucide-react';

export default function App() {
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [currentResult, setCurrentResult] = useState<QuestionResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Settings state with localStorage persistence
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const saved = localStorage.getItem('fotorespuesta_settings');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return {
      useOpenAi: false,
      openAiApiKey: '',
      autoFlash: false,
      keepHistory: true,
    };
  });

  // History state with localStorage persistence
  const [history, setHistory] = useState<QuestionResult[]>(() => {
    try {
      const saved = localStorage.getItem('fotorespuesta_history');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return [];
  });

  // Save history
  useEffect(() => {
    try {
      localStorage.setItem('fotorespuesta_history', JSON.stringify(history.slice(0, 30)));
    } catch (e) {}
  }, [history]);

  // Save settings
  useEffect(() => {
    try {
      localStorage.setItem('fotorespuesta_settings', JSON.stringify(settings));
    } catch (e) {}
  }, [settings]);

  // Handle Photo captured
  const handlePhotoCaptured = async (imageDataUrl: string) => {
    setCapturedPhoto(imageDataUrl);
    setError(null);
    setIsLoading(true);
    setCurrentResult(null);

    try {
      const response = await fetch('/api/answer-question', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image: imageDataUrl,
          openAiApiKey: settings.useOpenAi && settings.openAiApiKey.trim().length > 5
            ? settings.openAiApiKey.trim()
            : undefined,
        }),
      });

      const resData: AnswerApiResponse = await response.json();

      if (!response.ok || !resData.success || !resData.data) {
        throw new Error(resData.error || 'No se pudo obtener la respuesta a la pregunta.');
      }

      const newResult: QuestionResult = {
        id: Date.now().toString(),
        timestamp: Date.now(),
        imageUrl: imageDataUrl,
        ...resData.data,
      };

      setCurrentResult(newResult);
      setHistory((prev) => [newResult, ...prev]);
    } catch (err: any) {
      console.error('Error al resolver pregunta:', err);
      setError(
        err.message ||
          'Ocurrió un problema al analizar la imagen. Por favor toma una foto clara de la pregunta e inténtalo de nuevo.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  // One-tap reset to be ready for next question!
  const resetToCamera = () => {
    setCapturedPhoto(null);
    setCurrentResult(null);
    setError(null);
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans antialiased selection:bg-emerald-500 selection:text-slate-950">
      {/* Header */}
      <Header
        onOpenHistory={() => setIsHistoryOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        historyCount={history.length}
        hasCustomKey={settings.useOpenAi && Boolean(settings.openAiApiKey)}
      />

      {/* Main Container */}
      <main className="flex-1 flex flex-col justify-start pb-8">
        {/* Error Banner */}
        {error && (
          <div className="w-full max-w-xl mx-auto px-4 pt-4">
            <div className="p-4 rounded-2xl bg-rose-500/15 border border-rose-500/40 text-rose-200 text-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
              <button
                onClick={resetToCamera}
                className="px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-400 text-slate-950 font-bold text-xs shrink-0 self-end sm:self-auto transition-all flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reintentar</span>
              </button>
            </div>
          </div>
        )}

        {/* Dynamic Views: Camera vs Loading vs Result */}
        {isLoading ? (
          <LoadingState capturedImage={capturedPhoto} />
        ) : currentResult ? (
          <AnswerCard result={currentResult} onReset={resetToCamera} />
        ) : (
          <CameraScanner onPhotoCaptured={handlePhotoCaptured} isLoading={isLoading} />
        )}
      </main>

      {/* History Slide-over Drawer */}
      <HistoryDrawer
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        history={history}
        onSelectResult={(item) => {
          setCurrentResult(item);
          setCapturedPhoto(item.imageUrl || null);
          setError(null);
        }}
        onClearHistory={() => setHistory([])}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSaveSettings={(newSettings) => setSettings(newSettings)}
      />
    </div>
  );
}
