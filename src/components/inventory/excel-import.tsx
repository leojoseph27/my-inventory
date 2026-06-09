'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useInventoryStore } from '@/store/inventory-store';
import { ArrowLeft, Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export function ExcelImport() {
  const { setView, goBack } = useInventoryStore();
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ imported: number; errors: number; total: number } | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (file: File) => {
    if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || file.name.endsWith('.csv')) {
      setSelectedFile(file);
      setResult(null);
    } else {
      toast.error('Please select an Excel file (.xlsx, .xls, or .csv)');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleImport = async () => {
    if (!selectedFile) return;

    setImporting(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const res = await fetch('/api/products/import', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        setResult(data);
        if (data.errors > 0) {
          toast.warning(`Imported ${data.imported} products with ${data.errors} errors`);
        } else {
          toast.success(`Successfully imported ${data.imported} products`);
        }
        setSelectedFile(null);
      } else {
        toast.error('Failed to import Excel file');
      }
    } catch (error) {
      console.error('Error importing:', error);
      toast.error('Failed to import Excel file');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-4 pb-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={goBack} className="h-9 w-9 p-0">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold">Import from Excel</h1>
          <p className="text-sm text-muted-foreground">Upload an Excel file to import products</p>
        </div>
      </div>

      {/* Expected Format */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Expected Format</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-xs text-muted-foreground space-y-1">
            <p>Column headers should match:</p>
            <div className="flex flex-wrap gap-1 mt-2">
              {['Sr', 'English Description', 'Arabic Description', 'ND Number', 'Barcode', 'Colour', 'L', 'W', 'H', 'Made', 'Material', 'Additional Info', 'Price', 'Pcs'].map((col) => (
                <span key={col} className="bg-muted px-2 py-0.5 rounded text-[10px] font-mono">
                  {col}
                </span>
              ))}
            </div>
            <p className="mt-2 text-xs">
              Multi-value fields (Colour, Material, Additional Info) should be comma-separated: <code className="bg-muted px-1 rounded">Silver, Black, Gold</code>
            </p>
          </div>
        </CardContent>
      </Card>

      {/* File Upload Area */}
      <Card>
        <CardContent className="pt-4">
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
            }`}
            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
          >
            <FileSpreadsheet className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
            {selectedFile ? (
              <div>
                <p className="font-medium text-sm">{selectedFile.name}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {(selectedFile.size / 1024).toFixed(1)} KB
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => setSelectedFile(null)}
                >
                  Remove
                </Button>
              </div>
            ) : (
              <div>
                <p className="text-sm text-muted-foreground mb-2">
                  Drag and drop your Excel file here
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Select File
                </Button>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => {
                if (e.target.files?.[0]) handleFileSelect(e.target.files[0]);
              }}
              className="hidden"
            />
          </div>

          <Button
            className="w-full mt-4 h-11"
            disabled={!selectedFile || importing}
            onClick={handleImport}
          >
            {importing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Import Products
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Import Result */}
      {result && (
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-6 w-6 text-emerald-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Import Complete</p>
                <div className="text-sm text-muted-foreground mt-1 space-y-0.5">
                  <p>Total rows: {result.total}</p>
                  <p>Successfully imported: {result.imported}</p>
                  {result.errors > 0 && (
                    <p className="text-amber-600 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      Errors: {result.errors}
                    </p>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => setView('products')}
                >
                  View Products
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
