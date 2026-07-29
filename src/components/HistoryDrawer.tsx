import React from 'react';
import { X, History, Trash2, CheckCircle2, ChevronRight, BookOpen } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { QuestionResult } from '../types';

interface HistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  history: QuestionResult[];
  onSelectResult: (result: QuestionResult) => void;
  onClearHistory: () => void;
}

export const HistoryDrawer: React.FC<HistoryDrawerProps> = ({
  isOpen,
  onClose,
  history,
  onSelectResult,
  onClearHistory,
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-40"
          />

          {/* Drawer Content */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-slate-900 border-l border-slate-800 z-50 flex flex-col shadow-2xl"
          >
            {/* Header */}
            <div className="p-4 border-b border-slate-800 flex items-center justify-between text-white">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-emerald-400" />
                <h2 className="font-bold text-base">Historial de Preguntas</h2>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
                  {history.length}
                </span>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {history.length === 0 ? (
                <div className="text-center py-12 text-slate-500 space-y-3">
                  <BookOpen className="w-12 h-12 mx-auto text-slate-700" />
                  <p className="text-sm font-medium">Aún no has tomado fotos de preguntas</p>
                  <p className="text-xs text-slate-600">
                    Las preguntas que escanees aparecerán aquí para tu consulta.
                  </p>
                </div>
              ) : (
                history.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => {
                      onSelectResult(item);
                      onClose();
                    }}
                    className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 hover:border-emerald-500/40 hover:bg-slate-800/40 cursor-pointer transition-all flex items-start gap-3 group"
                  >
                    {item.imageUrl && (
                      <img
                        src={item.imageUrl}
                        alt="Miniatura"
                        className="w-14 h-14 rounded-xl object-cover shrink-0 border border-slate-800"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] text-slate-500 font-mono">
                          {new Date(item.timestamp).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        {item.subject && (
                          <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-800 text-emerald-400 font-medium">
                            {item.subject}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-300 font-semibold line-clamp-1 mb-1">
                        {item.questionText}
                      </p>
                      <div className="text-xs font-bold text-emerald-400 flex items-center gap-1 line-clamp-1">
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        <span>{item.directAnswer}</span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-emerald-400 transition-colors shrink-0 my-auto" />
                  </div>
                ))
              )}
            </div>

            {/* Clear History Footer */}
            {history.length > 0 && (
              <div className="p-4 border-t border-slate-800 bg-slate-950/50">
                <button
                  onClick={onClearHistory}
                  className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-rose-950/40 hover:text-rose-400 text-slate-400 font-semibold text-xs transition-colors flex items-center justify-center gap-2 border border-slate-700/60 hover:border-rose-800/50"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Borrar historial de esta sesión</span>
                </button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
