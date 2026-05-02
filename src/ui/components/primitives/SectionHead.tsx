/** @jsxImportSource preact */

interface SectionHeadProps {
  title: string
  action?: {
    label: string
    onClick: () => void
  }
}

export function SectionHead({ title, action }: SectionHeadProps) {
  return (
    <div class="bp-wsec">
      <span class="bp-wsec__title">{title}</span>
      {action && (
        <button class="bp-wsec__more" onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </div>
  )
}
