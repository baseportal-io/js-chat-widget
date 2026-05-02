/** @jsxImportSource preact */

interface AvatarProps {
  initials: string
  imageUrl?: string | null
  variantSeed?: string
  online?: boolean
  size?: 'sm' | 'md' | 'lg'
  class?: string
}

/**
 * Renders a circular avatar. Background color is picked
 * deterministically from `variantSeed` so the same admin always lands
 * on the same hue across views (header, message bubble, list).
 */
export function Avatar({
  initials,
  imageUrl,
  variantSeed,
  online,
  size = 'md',
  class: className = '',
}: AvatarProps) {
  const variantClass = `bp-av-${variantFromSeed(variantSeed || initials)}`
  const sizeStyle = size === 'sm'
    ? { width: 24, height: 24, fontSize: 10 }
    : size === 'lg'
      ? { width: 44, height: 44, fontSize: 14 }
      : undefined

  return (
    <div
      class={`bp-avatar ${variantClass} ${className}`.trim()}
      style={sizeStyle}
    >
      {imageUrl ? <img src={imageUrl} alt={initials} /> : initials}
      {online && <span class="bp-avatar__online" />}
    </div>
  )
}

function variantFromSeed(seed: string): number {
  let hash = 0
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0
  return (Math.abs(hash) % 6) + 1
}
