import { useMemo } from "react";
import type { SelectOption } from "../../api.ts";

const optionValue = (option: SelectOption) => option.value || option.label;
const inputValue = (options: SelectOption[], value: string) =>
  options.find((option) => option.value === value)?.label ?? value;

export function SearchSelect({
  id,
  label,
  value,
  options,
  onChange,
  required = false,
}: {
  id: string;
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  required?: boolean;
}) {
  const listId = `${id}-options`;
  const visible = useMemo(() => {
    const needle = value.toLowerCase();
    return options.filter((option) =>
      option.label.toLowerCase().includes(needle)
    )
      .slice(0, 80);
  }, [options, value]);

  return (
    <label htmlFor={id}>
      {label}
      <input
        id={id}
        list={listId}
        value={inputValue(options, value)}
        onChange={(event) => {
          const typed = event.target.value;
          const matched = options.find((option) =>
            option.label === typed || option.value === typed
          );
          onChange(matched ? optionValue(matched) : typed);
        }}
        required={required}
        autoComplete="off"
      />
      <datalist id={listId}>
        {visible.map((option) => (
          <option key={option.value} value={option.label} />
        ))}
      </datalist>
    </label>
  );
}
