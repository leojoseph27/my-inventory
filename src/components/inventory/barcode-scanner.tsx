'use client';

import { useRef, useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Camera, ScanLine } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';

interface BarcodeScannerProps {
  onScan: (barcode: string) => void;
}

export function BarcodeScanner({ onScan }: BarcodeScannerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const onScanRef = useRef(onScan);

  // Keep onScan ref in sync via callback pattern
  const handleScanResult = useCallback((barcode: string) => {
    onScan(barcode);
  }, [onScan]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  }, []);

  const handleOpen = useCallback(() => {
    setIsOpen(true);
    // Start camera after dialog opens
    setTimeout(async () => {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        streamRef.current = mediaStream;
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      } catch (error) {
        console.error('Camera access error:', error);
        alert('Unable to access camera. Please check permissions.');
        setIsOpen(false);
      }
    }, 100);
  }, []);

  const handleClose = useCallback(() => {
    stopCamera();
    setIsOpen(false);
  }, [stopCamera]);

  const captureBarcode = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0);

    if ('BarcodeDetector' in window) {
      const detector = new (window as any).BarcodeDetector({
        formats: ['ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a', 'upc_e', 'qr_code'],
      });

      detector.detect(canvas).then((barcodes: any[]) => {
        if (barcodes.length > 0) {
          handleScanResult(barcodes[0].rawValue);
          handleClose();
        }
      }).catch(console.error);
    } else {
      alert('Barcode detection not supported in this browser. Please enter the barcode manually.');
      handleClose();
    }
  }, [handleScanResult, handleClose]);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleOpen}
        className="h-11 px-3"
      >
        <Camera className="h-4 w-4" />
      </Button>

      <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
        <DialogContent className="max-w-sm p-4">
          <DialogTitle>Scan Barcode</DialogTitle>
          <div className="relative aspect-[4/3] bg-black rounded-lg overflow-hidden">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-3/4 h-1/3 border-2 border-white/70 rounded-lg flex items-center justify-center">
                <ScanLine className="h-8 w-8 text-white/70 animate-pulse" />
              </div>
            </div>
          </div>
          <canvas ref={canvasRef} className="hidden" />
          <div className="flex gap-2 mt-3">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={handleClose}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="flex-1"
              onClick={captureBarcode}
            >
              Scan
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
