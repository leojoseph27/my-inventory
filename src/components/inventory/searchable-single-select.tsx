'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { Check, X, ChevronsUpDown, Plus, CheckCircle2 } from 'lucide-react';

interface SearchableSingleSelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  suggestions: string[];
  placeholder?: string;
  emptyMessage?: string;
  className?: string;
  /** If true, show a "+" button next to the field for adding custom values */
  allowAddNew?: boolean;
  /** Called when a new custom value is added via the "+" button. Use this to persist the value. */
  onNewValuePersist?: (value: string) => void;
}

/**
 * Autocomplete combobox single-select.
 *
 * Behaviour:
 * - Click the trigger → popover opens showing ALL available options immediately
 * - Type to filter the list (narrows as you type)
 * - Click an option to select it (replaces any previous selection)
 * - Selected item shows a checkmark and the trigger displays the selected value
 * - Clear button (×) to deselect
 * - Optional "+" button beside the field for adding custom values that persist
 * - Mobile-friendly, full-width dropdown
 */
export function SearchableSingleSelect({
  label,
  value,
  onChange,
  suggestions,
  placeholder,
  emptyMessage,
  className,
  allowAddNew = false,
  onNewValuePersist,
}: SearchableSingleSelectProps) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // "+" button state
  const [showAddInput, setShowAddInput] = useState(false);
  const [addInputValue, setAddInputValue] = useState('');
  const addInputRef = useRef<HTMLInputElement>(null);

  // ── Filtering ────────────────────────────────────────────────────────
  const searchLower = inputValue.toLowerCase();
  const filteredSuggestions = searchLower
    ? suggestions.filter((s) => s.toLowerCase().includes(searchLower))
    : suggestions;

  // Can the user add a brand-new value inside the dropdown?
  const trimmedInput = inputValue.trim();
  const isExactMatch = suggestions.some(
    (s) => s.toLowerCase() === trimmedInput.toLowerCase()
  );
  const isAlreadySelected = value.toLowerCase() === trimmedInput.toLowerCase();
  const canAddNew =
    trimmedInput.length > 0 && !isExactMatch && !isAlreadySelected;

  // ── Handlers ─────────────────────────────────────────────────────────
  const handleSelect = useCallback(
    (selectedValue: string) => {
      const normalized = selectedValue.trim();
      if (!normalized) return;

      if (value.toLowerCase() === normalized.toLowerCase()) {
        // Deselect
        onChange('');
      } else {
        // Select
        onChange(normalized);
      }
      setInputValue('');
      setOpen(false);
    },
    [value, onChange]
  );

  const handleAddNew = useCallback(() => {
    if (!trimmedInput || isAlreadySelected) return;
    onChange(trimmedInput);
    setInputValue('');
    setOpen(false);
  }, [trimmedInput, isAlreadySelected, value, onChange]);

  const handleClear = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onChange('');
    },
    [onChange]
  );

  // ── "+" button handler ───────────────────────────────────────────────
  const handlePlusAdd = useCallback(() => {
    const trimmed = addInputValue.trim();
    if (!trimmed) return;

    // Set as the selected value
    onChange(trimmed);

    // Persist for future use
    if (onNewValuePersist) {
      onNewValuePersist(trimmed);
    }

    // Reset input state
    setAddInputValue('');
    setShowAddInput(false);
  }, [addInputValue, onChange, onNewValuePersist]);

  const handlePlusKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handlePlusAdd();
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setAddInputValue('');
        setShowAddInput(false);
      }
    },
    [handlePlusAdd]
  );

  // Auto-focus the add input when it appears
  useEffect(() => {
    if (showAddInput) {
      const timer = setTimeout(() => addInputRef.current?.focus(), 0);
      return () => clearTimeout(timer);
    }
  }, [showAddInput]);

  // ── Keyboard ─────────────────────────────────────────────────────────
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && canAddNew) {
        e.preventDefault();
        handleAddNew();
      }
    },
    [canAddNew, handleAddNew]
  );

  // ── Auto-focus input on open ─────────────────────────────────────────
  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => inputRef.current?.focus(), 0);
      return () => clearTimeout(timer);
    }
  }, [open]);

  // Reset input when closing
  useEffect(() => {
    if (!open) setInputValue('');
  }, [open]);

  return (
    <div className={cn('space-y-2', className)}>
      <label className="text-sm font-medium text-foreground">{label}</label>

      {/* ── Combobox trigger + "+" button ──────────────────────────────── */}
      <div className="flex gap-2">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              role="combobox"
              aria-expanded={open}
              aria-label={label}
              className={cn(
                'flex h-11 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm',
                'ring-offset-background placeholder:text-muted-foreground',
                'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
                'hover:bg-accent/50 transition-colors',
                'disabled:cursor-not-allowed disabled:opacity-50'
              )}
            >
              <span className={cn('truncate', !value && 'text-muted-foreground')}>
                {value || placeholder || `Select ${label.toLowerCase()}...`}
              </span>
              <div className="flex items-center gap-1 shrink-0">
                {value && (
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={handleClear}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleClear(e as any); }}
                    className="rounded-full p-0.5 hover:bg-muted-foreground/20 transition-colors"
                    aria-label={`Clear ${label}`}
                  >
                    <X className="h-3.5 w-3.5 opacity-50 hover:opacity-100" />
                  </span>
                )}
                <ChevronsUpDown className="h-4 w-4 opacity-50" />
              </div>
            </button>
          </PopoverTrigger>

          <PopoverContent
            className="w-[--radix-popover-trigger-width] p-0"
            align="start"
            sideOffset={4}
          >
            <Command shouldFilter={false} className="w-full">
              <CommandInput
                ref={inputRef}
                value={inputValue}
                onValueChange={setInputValue}
                onKeyDown={handleKeyDown}
                placeholder={`Search ${label.toLowerCase()}...`}
              />
              <CommandList className="max-h-[220px]">
                {filteredSuggestions.length === 0 && !canAddNew && inputValue.length > 0 && (
                  <CommandEmpty>
                    {emptyMessage || `No ${label.toLowerCase()} found.`}
                  </CommandEmpty>
                )}

                {filteredSuggestions.length > 0 && (
                  <CommandGroup>
                    {filteredSuggestions.map((suggestion) => {
                      const isSelected = value.toLowerCase() === suggestion.toLowerCase();
                      return (
                        <CommandItem
                          key={suggestion}
                          value={suggestion}
                          onSelect={() => handleSelect(suggestion)}
                          className={cn('cursor-pointer', isSelected && 'bg-accent/50')}
                        >
                          <Check
                            className={cn(
                              'mr-2 h-4 w-4 shrink-0',
                              isSelected ? 'opacity-100' : 'opacity-0'
                            )}
                          />
                          <span
                            className={cn(
                              'flex-1',
                              isSelected && 'font-medium'
                            )}
                          >
                            {suggestion}
                          </span>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                )}

                {/* ── "Add new" option inside dropdown ──────────────────── */}
                {canAddNew && (
                  <CommandGroup>
                    <CommandItem
                      onSelect={handleAddNew}
                      className="cursor-pointer text-primary font-medium"
                    >
                      <span className="mr-2 text-base">+</span>
                      <span>Add &ldquo;{trimmedInput}&rdquo;</span>
                    </CommandItem>
                  </CommandGroup>
                )}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        {/* ── "+" button to add custom value ──────────────────────────── */}
        {allowAddNew && (
          <button
            type="button"
            onClick={() => setShowAddInput(!showAddInput)}
            className={cn(
              'flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-input bg-background',
              'hover:bg-accent/50 transition-colors',
              'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
              showAddInput && 'bg-accent/50 ring-2 ring-ring ring-offset-2'
            )}
            aria-label={`Add new ${label.toLowerCase()}`}
            title={`Add new ${label.toLowerCase()}`}
          >
            <Plus className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* ── Inline input for adding custom value ────────────────────── */}
      {allowAddNew && showAddInput && (
        <div className="flex gap-2 items-center">
          <input
            ref={addInputRef}
            type="text"
            value={addInputValue}
            onChange={(e) => setAddInputValue(e.target.value)}
            onKeyDown={handlePlusKeyDown}
            placeholder={`Enter new ${label.toLowerCase()}...`}
            className={cn(
              'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm',
              'ring-offset-background placeholder:text-muted-foreground',
              'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2'
            )}
          />
          <button
            type="button"
            onClick={handlePlusAdd}
            disabled={!addInputValue.trim()}
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-input bg-primary text-primary-foreground',
              'hover:bg-primary/90 transition-colors',
              'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
            aria-label={`Confirm add ${label.toLowerCase()}`}
            title="Confirm"
          >
            <CheckCircle2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              setAddInputValue('');
              setShowAddInput(false);
            }}
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-input bg-background',
              'hover:bg-accent/50 transition-colors',
              'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2'
            )}
            aria-label={`Cancel add ${label.toLowerCase()}`}
            title="Cancel"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
