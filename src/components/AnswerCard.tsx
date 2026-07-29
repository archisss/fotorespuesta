import React, { useState } from 'react';
import { CheckCircle2, Camera, Copy, Check, ChevronDown, ChevronUp, Sparkles, BookOpen, AlertCircle, RefreshCw } from 'lucide-react';
import { motion } from 'motion/react';
import { QuestionResult } from '../types';

interface AnswerCardProps {
  result: QuestionResult;
  onReset: () => void;
}

export const AnswerCard: React.FC<AnswerCardProps> = ({ result, onReset }) => {
  const [copied, setCopied] = useState(false);
  const [showExplanation, setShowExplanation] = useState(true);

  const copyToClipboard = () => {
    const textToCopy = `Pregunta: ${result.questionText}\n\nRespuesta Correcta: ${result.directAnswer}\n\nExplicación: ${result.explanation}`;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="w-full max-w-xl mx-auto flex flex-col gap-4 p-4"
    >
      {/* HIGHLIGHTED DIRECT ANSWER BANNER */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-emerald-950 via-slate-900 to-slate-950 border-2 border-emerald-500/50 shadow-2xl p-6 text-white">
        {/* Glow effect */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <CheckCircle2 className="w-5 h-5" />
            </span>
            <span className="text-xs font-bold tracking-widest text-emerald-400 uppercase">
              Respuesta Correcta
            </span>
          </div>
          {result.subject && (
            <span className="text-xs px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700 font-medium">
              {result.subject}
            </span>
          )}
        </div>

        {/* Big Bold Answer */}
        <div className="my-3 py-2 px-4 bg-emerald-500/15 rounded-2xl border border-emerald-500/40 shadow-inner">
          <p className="text-2xl sm:text-3xl font-extrabold text-emerald-300 leading-snug tracking-tight">
            {result.directAnswer}
          </p>
        </div>

        {/* Copy action */}
        <div className="flex items-center justify-end mt-2">
          <button
            onClick={copyToClipboard}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-emerald-300 transition-colors py-1 px-2.5 rounded-lg hover:bg-slate-800/80"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400 font-semibold">Copiado</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copiar respuesta</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* MULTIPLE CHOICE OPTIONS IF PRESENT */}
      {result.options && result.options.length > 0 && (
        <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-4 space-y-2">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
            Opciones Detectadas
          </h3>
          <div className="space-y-2">
            {result.options.map((opt, idx) => {
              const isCorrect = idx === result.correctOptionIndex;
              return (
                <div
                  key={idx}
                  className={`flex items-start gap-3 p-3 rounded-xl border text-sm font-medium transition-all ${
                    isCorrect
                      ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-200 font-bold shadow-sm'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400'
                  }`}
                >
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0 mt-0.5 ${
                      isCorrect
                        ? 'bg-emerald-500 text-slate-950 font-black'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {String.fromCharCode(65 + idx)}
                  </span>
                  <span className="flex-1 leading-relaxed">{opt}</span>
                  {isCorrect && (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ORIGINAL QUESTION & EXPLANATION CARD */}
      <div className="bg-slate-900/90 rounded-2xl border border-slate-800 overflow-hidden divide-y divide-slate-800/80">
        {/* Transcribed Question */}
        <div className="p-4 space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
            <BookOpen className="w-4 h-4 text-cyan-400" />
            <span>Pregunta Transcrita</span>
          </div>
          <p className="text-slate-200 text-sm font-medium leading-relaxed bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
            "{result.questionText}"
          </p>
        </div>

        {/* Explanation Toggle */}
        {result.explanation && (
          <div>
            <button
              onClick={() => setShowExplanation(!showExplanation)}
              className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-800/40 transition-colors"
            >
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <span>Explicación / Razonamiento</span>
              </div>
              {showExplanation ? (
                <ChevronUp className="w-4 h-4 text-slate-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              )}
            </button>

            {showExplanation && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="px-4 pb-4 text-xs text-slate-300 leading-relaxed bg-slate-950/40 pt-1"
              >
                <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/50">
                  {result.explanation}
                </div>
              </motion.div>
            )}
          </div>
        )}
      </div>

      {/* PRIMARY CTA: TOMAR OTRA FOTO */}
      <div className="sticky bottom-4 z-20 pt-2">
        <button
          onClick={onReset}
          className="w-full py-4 px-6 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 font-extrabold text-base rounded-2xl shadow-xl shadow-emerald-500/25 active:scale-[0.98] transition-all flex items-center justify-center gap-2.5 cursor-pointer border border-emerald-300/30"
        >
          <Camera className="w-6 h-6" />
          <span>TOMAR NUEVA FOTO</span>
        </button>
      </div>
    </motion.div>
  );
};
