'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { X, Flashlight, FlashlightOff, Camera, RotateCcw, Loader2, Check, AlertCircle } from 'lucide-react';

interface BarcodePhotoCaptureProps {
  onScan: (barcode: string) => void;
  onClose: () => void;
}

// ── Scan zone constants ──
// The red scan line sits at 50% of the image height.
// We crop a band around it equal to CROP_HEIGHT_PCT of image height.
const CROP_HEIGHT_PCT = 0.18; // 18% of image height centred on the red line
const SCAN_ZONE_WIDTH_PCT = 0.85; // 85% of image width for the scan zone

/**
 * Extract the best barcode-like number from OCR text.
 * Strips non-numeric characters, then picks the longest sequence
 * that matches common barcode lengths (8, 12, 13, 14 digits).
 */
function extractBarcodeFromOcr(text: string): string | null {
  // Remove obvious noise characters but keep digits and spaces/hyphens
  const cleaned = text.replace(/[^\d\s\-]/g, ' ');

  // Split into candidate number groups
  const candidates = cleaned.split(/\s+/).filter(Boolean);

  // Also try the entire string with only digits
  const allDigits = cleaned.replace(/\D/g, '');

  // Collect all digit-only sequences (also combine adjacent groups)
  const digitSequences: string[] = [];
  for (const c of candidates) {
    const d = c.replace(/\D/g, '');
    if (d.length >= 6) digitSequences.push(d);
  }
  if (allDigits.length >= 6) digitSequences.push(allDigits);

  // Deduplicate
  const unique = [...new Set(digitSequences)];

  // Preferred barcode lengths in order of priority
  const preferredLengths = [13, 12, 8, 14];

  for (const len of preferredLengths) {
    // First: exact length match
    const exact = unique.find(s => s.length === len);
    if (exact) return exact;

    // Second: string that starts or ends with a barcode-length subsequence
    for (const seq of unique) {
      if (seq.length > len) {
        const prefix = seq.substring(0, len);
        const suffix = seq.substring(seq.length - len);
        // Return prefix if it looks like a valid barcode (starts with non-zero)
        if (prefix[0] !== '0' || len === 8) return prefix;
        if (suffix[0] !== '0' || len === 8) return suffix;
      }
    }
  }

  // Fallback: longest digit sequence >= 7 digits
  const sorted = unique.sort((a, b) => b.length - a.length);
  const longest = sorted.find(s => s.length >= 7);
  if (longest) return longest.substring(0, 14); // cap at 14

  return null;
}

/**
 * Pre-process a canvas region for better OCR accuracy:
 * - Convert to greyscale
 * - Increase contrast
 * - Apply sharpening
 */
function preprocessForOcr(sourceCanvas: HTMLCanvasElement): HTMLCanvasElement {
  const w = sourceCanvas.width;
  const h = sourceCanvas.height;
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const ctx = out.getContext('2d')!;

  // Draw original
  ctx.drawImage(sourceCanvas, 0, 0);

  // Get pixel data
  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;

  // Greyscale + contrast boost
  const contrastFactor = 1.5; // 1.0 = no change
  const intercept = 128 * (1 - contrastFactor);
  for (let i = 0; i < data.length; i += 4) {
    const grey = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    const val = Math.min(255, Math.max(0, grey * contrastFactor + intercept));
    // Simple threshold for cleaner text
    const final = val > 140 ? 255 : 0;
    data[i] = data[i + 1] = data[i + 2] = final;
  }
  ctx.putImageData(imageData, 0, 0);

  return out;
}

/**
 * Barcode photo capture component — redesigned for accuracy.
 *
 * Key improvements:
 * 1. Red horizontal scan line overlay guides the user to align the barcode
 * 2. Only the narrow crop around the red line is analysed (ignoring surrounding text)
 * 3. Dual detection: barcode decoding first, then OCR fallback
 * 4. User sees cropped preview + detected barcode and must Confirm or Retake
 * 5. Full debug logging for deployment diagnostics
 *
 * Workflow:
 * 1. Open camera preview (rear camera, autofocus, torch toggle, red scan line)
 * 2. User clicks Capture → image freezes
 * 3. Crop the scan zone (≈18% of image height centred on red line)
 * 4. Try barcode detection on cropped region
 * 5. If barcode fails, run OCR on cropped region
 * 6. Show cropped preview + "Detected Barcode: XXXXXXXX" with Confirm / Retake
 * 7. On Confirm → populate search + auto-search
 * 8. If nothing found after all attempts → show "No barcode detected" with Retake
 */
export function BarcodePhotoCapture({ onScan, onClose }: BarcodePhotoCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const trackRef = useRef<MediaStreamTrack | null>(null);

  const [isStarting, setIsStarting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [noBarcodeFound, setNoBarcodeFound] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);

  // New states for confirm/retake flow
  const [croppedPreview, setCroppedPreview] = useState<string | null>(null);
  const [detectedBarcode, setDetectedBarcode] = useState<string | null>(null);
  const [processingStep, setProcessingStep] = useState<string>('');

  // ── Start camera on mount ──
  useEffect(() => {
    let cancelled = false;

    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });

        if (cancelled) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }

        streamRef.current = stream;
        const videoTrack = stream.getVideoTracks()[0];
        trackRef.current = videoTrack;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        // Check torch support
        try {
          const capabilities = videoTrack.getCapabilities?.();
          if (capabilities?.torch) {
            setTorchSupported(true);
          }
        } catch {
          // Torch not supported
        }

        // Try to apply continuous autofocus if supported
        try {
          const capabilities = videoTrack.getCapabilities?.();
          if (capabilities?.focusMode?.includes('continuous')) {
            await videoTrack.applyConstraints({
              advanced: [{ focusMode: 'continuous' } as any],
            });
          } else if (capabilities?.focusMode?.includes('auto')) {
            await videoTrack.applyConstraints({
              advanced: [{ focusMode: 'auto' } as any],
            });
          }
        } catch {
          // Focus mode not supported
        }

        if (!cancelled) {
          setIsStarting(false);
        }
      } catch (err: any) {
        if (!cancelled) {
          console.error('Camera start error:', err);
          const msg = err?.message || err?.toString() || '';
          if (msg.includes('Permission') || msg.includes('NotAllowed')) {
            setError('Camera permission denied. Please allow camera access and try again.');
          } else if (msg.includes('NotFound') || msg.includes('Requested device not found')) {
            setError('No camera found. Please connect a camera and try again.');
          } else {
            setError(`Could not start camera: ${msg || 'Unknown error'}`);
          }
          setIsStarting(false);
        }
      }
    };

    startCamera();

    return () => {
      cancelled = true;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
    };
  }, []);

  // ── Toggle flashlight/torch ──
  const toggleTorch = useCallback(async () => {
    if (!trackRef.current) return;
    try {
      const capabilities = trackRef.current.getCapabilities?.();
      if (capabilities?.torch) {
        const newState = !torchOn;
        await trackRef.current.applyConstraints({
          advanced: [{ torch: newState } as any],
        });
        setTorchOn(newState);
      }
    } catch (err) {
      console.error('Torch toggle error:', err);
    }
  }, [torchOn]);

  // ── Crop the scan zone from a full canvas ──
  const cropScanZone = useCallback((fullCanvas: HTMLCanvasElement): HTMLCanvasElement => {
    const imgW = fullCanvas.width;
    const imgH = fullCanvas.height;

    // Horizontal band centred vertically (where the red line is at 50%)
    const bandHeight = Math.round(imgH * CROP_HEIGHT_PCT);
    const bandTop = Math.round(imgH * 0.5 - bandHeight / 2);

    // Horizontal: use SCAN_ZONE_WIDTH_PCT centred
    const bandWidth = Math.round(imgW * SCAN_ZONE_WIDTH_PCT);
    const bandLeft = Math.round((imgW - bandWidth) / 2);

    const cropCanvas = document.createElement('canvas');
    cropCanvas.width = bandWidth;
    cropCanvas.height = bandHeight;
    const ctx = cropCanvas.getContext('2d')!;
    ctx.drawImage(
      fullCanvas,
      bandLeft, bandTop, bandWidth, bandHeight, // source rect
      0, 0, bandWidth, bandHeight               // dest rect
    );

    console.log('[BarcodeCapture] Crop region:', {
      original: `${imgW}x${imgH}`,
      cropRegion: `left=${bandLeft} top=${bandTop} w=${bandWidth} h=${bandHeight}`,
      cropped: `${bandWidth}x${bandHeight}`,
    });

    return cropCanvas;
  }, []);

  // ── Run OCR on a canvas and extract barcode ──
  const runOcr = useCallback(async (canvas: HTMLCanvasElement): Promise<string | null> => {
    setProcessingStep('Running OCR on cropped region...');
    try {
      const Tesseract = await import('tesseract.js');
      const worker = await Tesseract.createWorker('eng', 1, {
        logger: (m: any) => {
          if (m.status === 'recognizing text') {
            console.log(`[BarcodeCapture] OCR progress: ${Math.round((m.progress || 0) * 100)}%`);
          }
        },
      });

      // Configure for digit-heavy recognition
      await worker.setParameters({
        tessedit_char_whitelist: '0123456789 -',
        tessedit_pageseg_mode: '7', // Treat as single uniform block of text
      });

      const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
      const { data } = await worker.recognize(dataUrl);
      await worker.terminate();

      const ocrText = data.text || '';
      console.log('[BarcodeCapture] OCR raw result:', JSON.stringify(ocrText));

      const barcode = extractBarcodeFromOcr(ocrText);
      console.log('[BarcodeCapture] OCR extracted barcode:', barcode);
      return barcode;
    } catch (err) {
      console.error('[BarcodeCapture] OCR error:', err);
      return null;
    }
  }, []);

  // ── Run OCR on preprocessed (contrast-enhanced) image ──
  const runEnhancedOcr = useCallback(async (canvas: HTMLCanvasElement): Promise<string | null> => {
    setProcessingStep('Retrying with image enhancement...');
    console.log('[BarcodeCapture] Attempting enhanced OCR (contrast + sharpening)');

    const enhanced = preprocessForOcr(canvas);
    return runOcr(enhanced);
  }, [runOcr]);

  // ── Capture + Process ──
  const captureAndProcess = useCallback(async () => {
    const video = videoRef.current;
    const fullCanvas = canvasRef.current;
    if (!video || !fullCanvas) return;

    // Freeze video
    video.pause();

    // Draw full frame to canvas
    fullCanvas.width = video.videoWidth;
    fullCanvas.height = video.videoHeight;
    const ctx = fullCanvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, fullCanvas.width, fullCanvas.height);

    // Save full image for display
    const fullDataUrl = fullCanvas.toDataURL('image/jpeg', 0.92);
    setCapturedImage(fullDataUrl);
    setIsProcessing(true);
    setNoBarcodeFound(false);
    setDetectedBarcode(null);
    setCroppedPreview(null);

    console.log('[BarcodeCapture] Original image size:', `${fullCanvas.width}x${fullCanvas.height}`);

    // ── Crop scan zone ──
    const croppedCanvas = cropScanZone(fullCanvas);
    const croppedDataUrl = croppedCanvas.toDataURL('image/jpeg', 0.92);
    setCroppedPreview(croppedDataUrl);

    console.log('[BarcodeCapture] Cropped image size:', `${croppedCanvas.width}x${croppedCanvas.height}`);

    // ── Step 1: Barcode detection on cropped region ──
    setProcessingStep('Trying barcode detection...');
    let barcodeResult: string | null = null;

    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      const scanner = new Html5Qrcode('barcode-photo-scan-element');

      // Convert cropped canvas to file for scanFileV2
      const blob = await new Promise<Blob | null>((resolve) => {
        croppedCanvas.toBlob(resolve, 'image/jpeg', 0.92);
      });

      if (blob) {
        const file = new File([blob], 'cropped.jpg', { type: 'image/jpeg' });

        try {
          const result = await scanner.scanFileV2(file, false);
          barcodeResult = result.decodedText;
          console.log('[BarcodeCapture] Barcode detection result:', barcodeResult);
        } catch (scanErr: any) {
          console.log('[BarcodeCapture] Barcode detection failed on cropped region:', scanErr?.message || scanErr);
        } finally {
          try { scanner.clear(); } catch {}
        }
      }

      // Also try on full image as fallback (sometimes the library needs full context)
      if (!barcodeResult) {
        setProcessingStep('Trying barcode detection on full image...');
        const fullBlob = await new Promise<Blob | null>((resolve) => {
          fullCanvas.toBlob(resolve, 'image/jpeg', 0.92);
        });
        if (fullBlob) {
          const fullFile = new File([fullBlob], 'full.jpg', { type: 'image/jpeg' });
          const scanner2 = new Html5Qrcode('barcode-photo-scan-element-2');
          try {
            const result = await scanner2.scanFileV2(fullFile, false);
            barcodeResult = result.decodedText;
            console.log('[BarcodeCapture] Barcode detection on full image result:', barcodeResult);
          } catch (scanErr: any) {
            console.log('[BarcodeCapture] Barcode detection failed on full image:', scanErr?.message || scanErr);
          } finally {
            try { scanner2.clear(); } catch {}
          }
        }
      }
    } catch (err: any) {
      console.error('[BarcodeCapture] Barcode library error:', err);
    }

    // ── Step 2: OCR fallback on cropped region ──
    let ocrResult: string | null = null;

    if (!barcodeResult) {
      ocrResult = await runOcr(croppedCanvas);
    }

    // ── Step 3: Enhanced OCR (contrast boost + sharpening) ──
    if (!barcodeResult && !ocrResult) {
      ocrResult = await runEnhancedOcr(croppedCanvas);
    }

    // ── Determine final result ──
    const finalBarcode = barcodeResult || ocrResult;

    console.log('[BarcodeCapture] ── Results summary ──');
    console.log('[BarcodeCapture]   Barcode detection:', barcodeResult || '(none)');
    console.log('[BarcodeCapture]   OCR result:', ocrResult || '(none)');
    console.log('[BarcodeCapture]   Final selected barcode:', finalBarcode || '(none)');

    setIsProcessing(false);
    setProcessingStep('');

    if (finalBarcode) {
      setDetectedBarcode(finalBarcode);
    } else {
      setNoBarcodeFound(true);
    }
  }, [onScan, cropScanZone, runOcr, runEnhancedOcr]);

  // ── Confirm detected barcode → search ──
  const confirmBarcode = useCallback(() => {
    if (!detectedBarcode) return;
    // Stop camera
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    onScan(detectedBarcode);
  }, [detectedBarcode, onScan]);

  // ── Retry: go back to live camera ──
  const retry = useCallback(() => {
    setCapturedImage(null);
    setNoBarcodeFound(false);
    setIsProcessing(false);
    setCroppedPreview(null);
    setDetectedBarcode(null);
    setProcessingStep('');

    // Resume video
    if (videoRef.current && streamRef.current) {
      videoRef.current.play().catch(() => {});
    }
  }, []);

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col">
      {/* Hidden elements for html5-qrcode scanFileV2 */}
      <div id="barcode-photo-scan-element" style={{ display: 'none' }} />
      <div id="barcode-photo-scan-element-2" style={{ display: 'none' }} />

      {/* Hidden canvas for frame capture */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/80 text-white z-10">
        <h2 className="text-lg font-semibold">
          {detectedBarcode
            ? 'Barcode Detected'
            : capturedImage
              ? isProcessing
                ? processingStep || 'Processing...'
                : noBarcodeFound
                  ? 'No Barcode Found'
                  : 'Analyzing...'
              : 'Capture Barcode Photo'}
        </h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="text-white hover:bg-white/20 h-9 w-9 p-0"
        >
          <X className="h-5 w-5" />
        </Button>
      </div>

      {/* Camera / Captured image viewport */}
      <div className="flex-1 relative flex items-center justify-center overflow-hidden">
        {/* Live camera feed */}
        {!capturedImage && (
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            playsInline
            muted
            autoPlay
          />
        )}

        {/* Captured image (frozen frame) */}
        {capturedImage && !detectedBarcode && !noBarcodeFound && (
          <img
            src={capturedImage}
            alt="Captured barcode"
            className="w-full h-full object-contain"
          />
        )}

        {/* ── RED SCAN LINE OVERLAY (camera live) ── */}
        {!capturedImage && !error && !isStarting && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            {/* Scan zone rectangle */}
            <div
              className="relative border-2 border-red-500/80 rounded-lg"
              style={{
                width: `${SCAN_ZONE_WIDTH_PCT * 100}%`,
                height: `${CROP_HEIGHT_PCT * 100}%`,
              }}
            >
              {/* Corner markers */}
              <div className="absolute top-0 left-0 w-5 h-5 border-t-3 border-l-3 border-red-400 rounded-tl-md" />
              <div className="absolute top-0 right-0 w-5 h-5 border-t-3 border-r-3 border-red-400 rounded-tr-md" />
              <div className="absolute bottom-0 left-0 w-5 h-5 border-b-3 border-l-3 border-red-400 rounded-bl-md" />
              <div className="absolute bottom-0 right-0 w-5 h-5 border-b-3 border-r-3 border-red-400 rounded-br-md" />

              {/* Prominent red horizontal centre line */}
              <div className="absolute top-1/2 left-2 right-2 h-[3px] bg-red-500 -translate-y-1/2 shadow-[0_0_8px_rgba(239,68,68,0.6)]" />

              {/* Instruction text */}
              <div className="absolute -top-7 left-0 right-0 text-center">
                <span className="text-white text-xs bg-red-600/80 px-3 py-1 rounded-full font-medium">
                  Align barcode here
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Loading overlay — camera starting */}
        {isStarting && !error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60">
            <div className="h-10 w-10 border-3 border-white border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-white text-sm">Starting camera...</p>
          </div>
        )}

        {/* Processing overlay — extracting barcode */}
        {isProcessing && capturedImage && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70">
            <Loader2 className="h-10 w-10 text-white animate-spin mb-4" />
            <p className="text-white text-sm mb-2">{processingStep || 'Extracting barcode...'}</p>
            <div className="w-48 h-1.5 bg-white/20 rounded-full overflow-hidden">
              <div className="h-full bg-red-500 rounded-full animate-pulse" style={{ width: '60%' }} />
            </div>
          </div>
        )}

        {/* ── DETECTED BARCODE: cropped preview + confirm/retake ── */}
        {detectedBarcode && croppedPreview && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 px-6 py-4">
            {/* Cropped scan region preview */}
            <div className="w-full max-w-xs mb-4">
              <p className="text-white/60 text-xs text-center mb-2">Scanned region:</p>
              <div className="border-2 border-green-500/50 rounded-lg overflow-hidden">
                <img
                  src={croppedPreview}
                  alt="Cropped scan region"
                  className="w-full h-auto"
                />
              </div>
            </div>

            {/* Detected barcode display */}
            <div className="bg-green-900/40 border border-green-500/50 rounded-xl px-6 py-4 mb-6 text-center">
              <p className="text-green-400 text-xs mb-1">Detected Barcode</p>
              <p className="text-white text-2xl font-mono font-bold tracking-widest">{detectedBarcode}</p>
            </div>

            {/* Confirm / Retake buttons */}
            <div className="flex gap-3 w-full max-w-xs">
              <Button
                variant="outline"
                onClick={retry}
                className="flex-1 h-12 text-white border-white/30 hover:bg-white/10 gap-2"
              >
                <RotateCcw className="h-5 w-5" />
                Retake
              </Button>
              <Button
                onClick={confirmBarcode}
                className="flex-1 h-12 bg-green-600 hover:bg-green-700 text-white gap-2"
              >
                <Check className="h-5 w-5" />
                Confirm
              </Button>
            </div>
          </div>
        )}

        {/* No barcode found overlay */}
        {noBarcodeFound && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 px-6">
            {/* Show cropped preview if available so user can see what was scanned */}
            {croppedPreview && (
              <div className="w-full max-w-xs mb-4">
                <p className="text-white/40 text-xs text-center mb-2">Scanned region:</p>
                <div className="border border-amber-500/30 rounded-lg overflow-hidden opacity-60">
                  <img
                    src={croppedPreview}
                    alt="Cropped scan region"
                    className="w-full h-auto"
                  />
                </div>
              </div>
            )}
            <div className="text-center mb-6">
              <AlertCircle className="h-10 w-10 text-amber-400 mx-auto mb-3" />
              <p className="text-amber-400 text-lg font-medium mb-2">No barcode detected</p>
              <p className="text-white/70 text-sm">Align the barcode so it crosses the red line and try again.</p>
            </div>
            <Button
              variant="outline"
              onClick={retry}
              className="text-white border-white/30 hover:bg-white/10 gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              Try Again
            </Button>
          </div>
        )}

        {/* Error overlay */}
        {error && !noBarcodeFound && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 px-6">
            <div className="text-red-400 text-center mb-6">
              <p className="text-lg font-medium mb-2">Camera Error</p>
              <p className="text-sm">{error}</p>
            </div>
            <Button
              variant="outline"
              onClick={onClose}
              className="text-white border-white/30 hover:bg-white/10"
            >
              Go Back
            </Button>
          </div>
        )}
      </div>

      {/* Bottom controls */}
      <div className="flex items-center justify-center gap-4 px-4 py-4 bg-black/80">
        {/* Flashlight toggle (only when camera is live) */}
        {torchSupported && !capturedImage && !isStarting && (
          <Button
            variant="outline"
            size="sm"
            onClick={toggleTorch}
            className={`h-11 px-4 gap-2 ${
              torchOn
                ? 'bg-yellow-500 text-black border-yellow-500 hover:bg-yellow-400'
                : 'text-white border-white/30 hover:bg-white/10'
            }`}
          >
            {torchOn ? <FlashlightOff className="h-5 w-5" /> : <Flashlight className="h-5 w-5" />}
            {torchOn ? 'Flash On' : 'Flash Off'}
          </Button>
        )}

        {/* Capture button (when camera is live) */}
        {!capturedImage && !error && !isStarting && (
          <Button
            size="lg"
            onClick={captureAndProcess}
            className="h-14 px-8 gap-2 bg-white text-black hover:bg-white/90 font-semibold"
          >
            <Camera className="h-6 w-6" />
            Capture
          </Button>
        )}

        {/* Manual entry fallback (only when camera is live) */}
        {!capturedImage && (
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            className="text-white border-white/30 hover:bg-white/10 h-11 px-4"
          >
            Type Manually
          </Button>
        )}
      </div>

      {/* Instructions */}
      {!capturedImage && (
        <div className="text-center pb-6 px-4 bg-black/80">
          <p className="text-white/70 text-xs">
            Align the barcode so it crosses the red line, then press Capture.
          </p>
          <p className="text-white/40 text-[10px] mt-1">
            Supports: EAN-13, EAN-8, UPC-A, UPC-E, Code 128, Code 39
          </p>
        </div>
      )}
    </div>
  );
}
