/** @jsxImportSource preact */

import { IconSearch } from '../../icons'

interface SearchBarProps {
  value: string
  onInput: (value: string) => void
  placeholder: string
  variant?: 'card' | 'inline'
}

/**
 * Search input. `card` variant overlaps the hero gradient with a
 * shadowed white card (used on Home); `inline` is a flush variant
 * for the Help tab body.
 */
export function SearchBar({ value, onInput, placeholder, variant = 'card' }: SearchBarProps) {
  return (
    <div class={`bp-wsearch ${variant === 'inline' ? 'bp-wsearch--inline' : ''}`}>
      <IconSearch />
      <input
        type="text"
        value={value}
        onInput={(e) => onInput((e.target as HTMLInputElement).value)}
        placeholder={placeholder}
      />
    </div>
  )
}
