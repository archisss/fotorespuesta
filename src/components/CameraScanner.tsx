import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Camera, Upload, RotateCw, Image as ImageIcon, AlertCircle, Sparkles, Zap, Clipboard } from 'lucide-react';
import { motion } from 'motion/react';

interface CameraScannerProps {
  onPhotoCaptured: (imageDataUrl: string) => void;
  isLoading: boolean;
}

export const CameraScanner: React.FC<CameraScannerProps> = ({
  onPhotoCaptured,
  isLoading,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const nativeCameraInputRef = useRef<HTMLInputElement | null>(null);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  // Check camera devices count
  useEffect(() => {
    navigator.mediaDevices?.enumerateDevices?.().then((devices) => {
      const videoDevices = devices.filter((d) => d.kind === 'videoinput');
      setHasMultipleCameras(videoDevices.length > 1);
    }).catch(() => {});
  }, []);

  // Start video stream with fallback constraint logic
  const startCamera = useCallback(async () => {
    setCameraError(null);
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('El navegador no soporta el acceso directo a la cámara web.');
      }

      let newStream: MediaStream | null = null;
      // Constraint level 1: ideal resolution & facing mode
      try {
        newStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: facingMode,
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });
      } catch (err1) {
        // Constraint level 2: facing mode only
        try {
          newStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: facingMode },
            audio: false,
          });
        } catch (err2) {
          // Constraint level 3: basic video
          newStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
        }
      }

      if (!newStream) {
        throw new Error('No se pudo inicializar la secuencia de video.');
      }

      setStream(newStream);
      setIsCameraActive(true);
    } catch (err: any) {
      console.warn('No se pudo acceder a la cámara en vivo:', err);
      setIsCameraActive(false);
      let message = 'No se pudo conectar a la cámara en vivo.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        message = 'Permiso denegado. Presiona "Activar Cámara En Vivo" o usa "Tomar Foto con Cámara Nativa".';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        message = 'No se detectó cámara web. Puedes tomar una foto usando la cámara de tu dispositivo.';
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        message = 'La cámara está ocupada por otra app. Cierra la otra app o usa la cámara nativa.';
      }
      setCameraError(message);
    }
  }, [facingMode]);

  // Bind video element srcObject when video element mounts or stream changes
  useEffect(() => {
    if (isCameraActive && videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch((e) => console.warn('Error al reproducir video:', e));
    }
  }, [isCameraActive, stream]);

  useEffect(() => {
    startCamera();
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [facingMode]);

  // Handle camera switch
  const toggleCamera = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  // Capture photo from video stream
  const capturePhoto = () => {
    if (!videoRef.current || isLoading) return;

    const video = videoRef.current;
    const canvas = canvasRef.current || document.createElement('canvas');
    canvasRef.current = canvas;

    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      // If user facing, mirror the canvas horizontally so text isn't flipped
      if (facingMode === 'user') {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
      onPhotoCaptured(dataUrl);
    }
  };

  // Handle manual file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
    // Reset file input so taking or selecting another photo always triggers onChange
    e.target.value = '';
  };

  const processFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Por favor selecciona un archivo de imagen válido.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      if (dataUrl) {
        onPhotoCaptured(dataUrl);
      }
    };
    reader.readAsDataURL(file);
  };

  // Handle Drag and Drop
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  // Handle Paste from Clipboard
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (items) {
        for (let i = 0; i < items.length; i++) {
          if (items[i].type.indexOf('image') !== -1) {
            const blob = items[i].getAsFile();
            if (blob) processFile(blob);
            break;
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  return (
    <div className="w-full max-w-xl mx-auto flex flex-col gap-4 p-4">
      {/* Viewfinder Container */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        className={`relative aspect-[3/4] sm:aspect-[4/5] w-full bg-slate-950 rounded-3xl overflow-hidden border-2 transition-all shadow-2xl flex flex-col items-center justify-center ${
          isDragOver
            ? 'border-emerald-400 bg-emerald-950/20 scale-[0.99]'
            : 'border-slate-800'
        }`}
      >
        {isCameraActive ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`w-full h-full object-cover ${
              facingMode === 'user' ? 'scale-x-[-1]' : ''
            }`}
          />
        ) : (
          <div className="flex flex-col items-center text-center p-6 space-y-4 max-w-sm">
            <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 shadow-inner">
              <Camera className="w-8 h-8 text-emerald-400" />
            </div>
            <div>
              <p className="text-slate-200 font-semibold text-sm">
                Apunta o sube una imagen de la pregunta
              </p>
              <p className="text-slate-400 text-xs mt-1">
                Puedes transmitir en vivo, tomar foto con la app de cámara o subir de tu galería
              </p>
            </div>
            {cameraError && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 text-xs flex items-start gap-2 text-left">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span>{cameraError}</span>
              </div>
            )}
            
            <div className="flex flex-col gap-2.5 w-full pt-1">
              <button
                onClick={startCamera}
                className="w-full py-2.5 px-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-emerald-500/20 transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <Camera className="w-4 h-4" />
                Activar Cámara En Vivo
              </button>

              <button
                onClick={() => nativeCameraInputRef.current?.click()}
                className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-xl border border-slate-700 transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <Camera className="w-4 h-4 text-emerald-400" />
                Tomar Foto (Cámara Nativa)
              </button>

              <button
                onClick={() => galleryInputRef.current?.click()}
                className="w-full py-2 px-4 bg-transparent hover:bg-slate-900 text-slate-400 hover:text-slate-200 font-medium text-xs rounded-xl transition-all flex items-center justify-center gap-2"
              >
                <Upload className="w-4 h-4" />
                Elegir de la Galería
              </button>
            </div>
          </div>
        )}

        {/* Viewfinder Overlay Crosshairs & Focus Frame */}
        {isCameraActive && (
          <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-6">
            {/* Top Bar inside Camera */}
            <div className="flex items-center justify-between text-white text-xs bg-slate-900/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 w-fit mx-auto">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping mr-1.5" />
              <span>Apunta a la pregunta</span>
            </div>

            {/* Target Box Frame with Clean Minimalism corner accents */}
            <div className="relative w-full aspect-[4/3] my-auto rounded-2xl border border-slate-700/80 bg-slate-900/10 transition-all">
              {/* Corner Accents */}
              <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-emerald-500 rounded-tl-xl" />
              <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-emerald-500 rounded-tr-xl" />
              <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-emerald-500 rounded-bl-xl" />
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-emerald-500 rounded-br-xl" />

              {/* Scanning laser line animation */}
              <motion.div
                animate={{ top: ['0%', '100%', '0%'] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute left-2 right-2 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_12px_#10b981]"
              />
            </div>

            {/* Bottom Camera Controls Bar */}
            <div className="pointer-events-auto flex items-center justify-around w-full max-w-sm mx-auto bg-slate-900/80 backdrop-blur-lg px-4 py-3 rounded-full border border-slate-700/60 shadow-2xl">
              {/* Gallery upload */}
              <button
                onClick={() => galleryInputRef.current?.click()}
                className="p-3 rounded-full bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-all active:scale-90"
                title="Subir imagen desde galería"
              >
                <Upload className="w-5 h-5" />
              </button>

              {/* Shutter Button */}
              <button
                onClick={capturePhoto}
                disabled={isLoading}
                className="group relative p-1 rounded-full bg-gradient-to-tr from-emerald-500 via-teal-400 to-cyan-400 shadow-lg shadow-emerald-500/30 active:scale-90 transition-all disabled:opacity-50"
                title="Tomar Foto"
              >
                <div className="w-16 h-16 rounded-full bg-slate-950 flex items-center justify-center border-2 border-white/80 group-hover:bg-slate-900 transition-colors">
                  <div className="w-12 h-12 rounded-full bg-emerald-400 group-hover:scale-105 transition-transform flex items-center justify-center text-slate-950">
                    <Camera className="w-6 h-6" />
                  </div>
                </div>
              </button>

              {/* Switch Camera */}
              {hasMultipleCameras ? (
                <button
                  onClick={toggleCamera}
                  className="p-3 rounded-full bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-all active:scale-90"
                  title="Cambiar cámara"
                >
                  <RotateCw className="w-5 h-5" />
                </button>
              ) : (
                <div className="w-11" />
              )}
            </div>
          </div>
        )}
      </div>

      {/* Hidden File Inputs */}
      {/* Native Camera trigger for mobile browsers */}
      <input
        ref={nativeCameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
      />
      {/* Gallery file selection */}
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Quick Action Footer / Alternative Input Guidance */}
      <div className="flex items-center justify-between text-xs text-slate-400 px-3 py-2.5 bg-slate-900/50 rounded-2xl border border-slate-800/80">
        <div className="flex items-center gap-1.5">
          <Zap className="w-4 h-4 text-emerald-400" />
          <span>Formato: Opción múltiple, ejercicios o preguntas abiertas</span>
        </div>
        <button
          onClick={() => nativeCameraInputRef.current?.click()}
          className="text-emerald-400 hover:underline font-semibold flex items-center gap-1 shrink-0 ml-2"
        >
          <Camera className="w-3.5 h-3.5" />
          Foto Cámara
        </button>
      </div>
    </div>
  );
};
