'use client';

import { useState, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X, Plus } from 'lucide-react';

interface MultiValueInputProps {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
}

export function MultiValueInput({ label, values, onChange, placeholder }: MultiValueInputProps) {
  const [inputValue, setInputValue] = useState('');

  const addValue = useCallback(() => {
    const trimmed = inputValue.trim();
    if (trimmed && !values.includes(trimmed)) {
      onChange([...values, trimmed]);
      setInputValue('');
    }
  }, [inputValue, values, onChange]);

  const removeValue = useCallback((index: number) => {
    onChange(values.filter((_, i) => i !== index));
  }, [values, onChange]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addValue();
    }
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-foreground">{label}</label>
      <div className="space-y-2">
        {values.map((value, index) => (
          <div key={index} className="flex items-center gap-2">
            <div className="flex-1 flex items-center bg-muted/50 rounded-md px-3 py-2 border">
              <span className="text-sm flex-1">{value}</span>
              <button
                type="button"
                onClick={() => removeValue(index)}
                className="text-muted-foreground hover:text-destructive transition-colors p-1 -mr-1"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
        <div className="flex items-center gap-2">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder || `Add ${label.toLowerCase()}`}
            className="flex-1 h-11"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addValue}
            disabled={!inputValue.trim()}
            className="h-11 px-3"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
