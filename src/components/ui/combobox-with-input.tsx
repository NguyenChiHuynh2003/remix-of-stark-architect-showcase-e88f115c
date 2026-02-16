import * as React from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";

interface ComboboxOption {
  value: string;
  label: string;
  sublabel?: string;
}

interface ComboboxWithInputProps {
  options: ComboboxOption[];
  value: string;
  customValue?: string;
  onValueChange: (value: string, isCustom: boolean) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  className?: string;
  disabled?: boolean;
}

export function ComboboxWithInput({
  options,
  value,
  customValue,
  onValueChange,
  placeholder = "Chọn hoặc nhập...",
  searchPlaceholder = "Tìm kiếm...",
  emptyMessage = "Không tìm thấy.",
  className,
  disabled,
}: ComboboxWithInputProps) {
  const [open, setOpen] = React.useState(false);
  const [isCustomMode, setIsCustomMode] = React.useState(!!customValue);
  const [inputValue, setInputValue] = React.useState(customValue || "");

  // Reset state when value changes externally
  React.useEffect(() => {
    if (customValue) {
      setIsCustomMode(true);
      setInputValue(customValue);
    } else if (value) {
      setIsCustomMode(false);
      setInputValue("");
    }
  }, [value, customValue]);

  const selectedOption = options.find((opt) => opt.value === value);

  const handleSelect = (selectedValue: string) => {
    if (selectedValue === value) {
      onValueChange("", false);
    } else {
      onValueChange(selectedValue, false);
    }
    setIsCustomMode(false);
    setInputValue("");
    setOpen(false);
  };

  const handleCustomInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    setIsCustomMode(true);
    onValueChange(newValue, true);
  };

  const handleClear = () => {
    setInputValue("");
    setIsCustomMode(false);
    onValueChange("", false);
  };

  const switchToCustomMode = () => {
    setIsCustomMode(true);
    onValueChange("", false);
  };

  if (isCustomMode) {
    return (
      <div className="relative">
        <Input
          value={inputValue}
          onChange={handleCustomInput}
          placeholder="Nhập tên..."
          className={cn("pr-16", className)}
          disabled={disabled}
        />
        <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => {
              setIsCustomMode(false);
              setInputValue("");
              onValueChange("", false);
            }}
            disabled={disabled}
          >
            Chọn
          </Button>
          {inputValue && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={handleClear}
              disabled={disabled}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              "w-full justify-between font-normal",
              !value && "text-muted-foreground",
              className
            )}
            disabled={disabled}
          >
            <span className="truncate">
              {selectedOption ? (
                <span>
                  {selectedOption.label}
                  {selectedOption.sublabel && (
                    <span className="text-muted-foreground ml-1">
                      {selectedOption.sublabel}
                    </span>
                  )}
                </span>
              ) : (
                placeholder
              )}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 z-50" align="start">
          <Command>
            <CommandInput placeholder={searchPlaceholder} />
            <CommandList>
              <CommandEmpty>
                <div className="py-2 text-center text-sm">
                  <p className="text-muted-foreground mb-2">{emptyMessage}</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      switchToCustomMode();
                      setOpen(false);
                    }}
                  >
                    Nhập thủ công
                  </Button>
                </div>
              </CommandEmpty>
              <CommandGroup>
                {options.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={option.label}
                    onSelect={() => handleSelect(option.value)}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === option.value ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex flex-col">
                      <span>{option.label}</span>
                      {option.sublabel && (
                        <span className="text-xs text-muted-foreground">
                          {option.sublabel}
                        </span>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
            <div className="border-t p-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full text-muted-foreground hover:text-foreground"
                onClick={() => {
                  switchToCustomMode();
                  setOpen(false);
                }}
              >
                + Nhập thủ công
              </Button>
            </div>
          </Command>
        </PopoverContent>
      </Popover>
      {value && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-8 top-1/2 -translate-y-1/2 h-6 w-6"
          onClick={handleClear}
          disabled={disabled}
        >
          <X className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}
