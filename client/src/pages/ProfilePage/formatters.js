export const PALETTE = [
  '#3b82f6', '#22d3ee', '#4ade80', '#f59e0b',
  '#a78bfa', '#f472b6', '#fb923c', '#34d399',
];

export const fmtUSD = v =>
  Number(v || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });

export const fmtPct = (v, signed = true) => {
  const n = Number(v || 0);
  return `${signed && n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
};

export const fmtDate = v => {
  if (!v) return '\u2014';
  return new Date(v).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};

export const fmtTime = v => {
  if (!v) return '\u2014';
  const d = new Date(v);
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};
