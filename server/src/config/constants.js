export const SYMBOLS = [
  'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT',
  'ADAUSDT', 'DOGEUSDT', 'AVAXUSDT', 'LINKUSDT', 'DOTUSDT',
  'TRXUSDT', 'MATICUSDT', 'LTCUSDT', 'BCHUSDT', 'UNIUSDT',
  'ATOMUSDT', 'ETCUSDT', 'FILUSDT', 'APTUSDT', 'ARBUSDT',
  'OPUSDT', 'NEARUSDT', 'INJUSDT', 'SUIUSDT', 'SEIUSDT',
];

export const SYMBOLS_SET = new Set(SYMBOLS);

export const STREAM_SYMBOLS = SYMBOLS.map(s => s.toLowerCase());

export const TIMEFRAMES = ['1m', '5m', '1D', '1W', '1M'];

export const TF_INTERVAL = {
  '1m': 'toStartOfMinute(timestamp)',
  '5m': 'toStartOfFiveMinute(timestamp)',
  '1D': 'toStartOfDay(timestamp)',
  '1W': 'toStartOfWeek(timestamp)',
  '1M': 'toStartOfMonth(timestamp)',
};

export const TF_LIMIT = {
  '1m': 100,
  '5m': 200,
  '1D': 365,
  '1W': 104,
  '1M': 36,
};

export const DAILY_TF = new Set(['1D', '1W', '1M']);
