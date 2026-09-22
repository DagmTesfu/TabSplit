// Deterministic palette for consistent avatar styles across all views
const AVATAR_PALETTES = [
  { bg: '#eff6ff', color: '#1e3a5f', border: '#bfdbfe' }, // Navy / Blue
  { bg: '#fef3c7', color: '#d97706', border: '#fde68a' }, // Amber
  { bg: '#fce7f3', color: '#db2777', border: '#fbcfe8' }, // Pink
  { bg: '#ecfdf5', color: '#0f7b5f', border: '#a7f3d0' }, // Emerald
  { bg: '#f3e8ff', color: '#7e22ce', border: '#e9d5ff' }, // Purple
  { bg: '#ffedd5', color: '#c2410c', border: '#fed7aa' }, // Orange
];

export function getAvatarColor(idOrName = '') {
  let hash = 0;
  const str = String(idOrName);
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % AVATAR_PALETTES.length;
  return AVATAR_PALETTES[index];
}

export function getInitials(name = '') {
  const trimmed = name.trim();
  if (!trimmed) return '?';
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) {
    return parts[0].substring(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
