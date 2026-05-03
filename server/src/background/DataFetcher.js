import { fetchKlines } from '../services/BinanceService.js';
import { insert, query } from '../services/ClickHouseClient.js';

const SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT'];

// Her sembol için kaç günlük geçmiş veri çekilecek
const DAYS_HISTORY = 30;

/**
 * Binance'den toplu tarihsel veri çeker ve ClickHouse'a yazar.
 * Her istek max 1000 mum, birden fazla batch ile geçmişi doldurur.
 */
async function fetchHistorical(symbol, interval = '1m', daysBack = DAYS_HISTORY) {
  const MS_PER_CANDLE = {
    '1m':  60 * 1000,
    '5m':  5 * 60 * 1000,
    '1d':  24 * 60 * 60 * 1000,
    '1w':  7 * 24 * 60 * 60 * 1000,
  };

  const candleMs = MS_PER_CANDLE[interval] || 60 * 1000;
  const totalCandles = Math.ceil((daysBack * 24 * 60 * 60 * 1000) / candleMs);
  const batchSize = 1000;
  const batches = Math.ceil(totalCandles / batchSize);

  console.log(`[${symbol}] ${interval} — ${daysBack} günlük veri, ${batches} batch...`);

  let endTime = Date.now();
  let totalInserted = 0;

  for (let i = 0; i < batches; i++) {
    const klines = await fetchKlines(symbol, interval, batchSize, endTime);
    if (!klines || klines.length === 0) break;

    const rows = klines.map(k => ({
      symbol:    symbol.toUpperCase(),
      timestamp: new Date(k.time).toISOString().replace('T', ' ').slice(0, 23),
      open:      k.open,
      high:      k.high,
      low:       k.low,
      close:     k.close,
      volume:    k.volume,
    }));

    await insert('market_data', rows);
    totalInserted += rows.length;

    // Bir sonraki batch için endTime'ı en eski mumun zamanına çek
    endTime = klines[0].time - 1;

    console.log(`[${symbol}] Batch ${i + 1}/${batches} — ${rows.length} mum yazıldı`);

    // Binance rate limit için kısa bekleme
    await sleep(300);
  }

  console.log(`✅ [${symbol}] ${interval} — toplam ${totalInserted} mum eklendi`);
}

/**
 * ClickHouse'daki en eski timestamp'i kontrol et,
 * eksik verileri doldur
 */
async function fillGaps(symbol) {
  try {
    const { rows } = await query(
      `SELECT min(timestamp) AS oldest, max(timestamp) AS newest, count() AS total
       FROM market_data WHERE symbol = {sym: String}`,
      { sym: symbol.toUpperCase() }
    );

    const { oldest, newest, total } = rows[0] || {};
    console.log(`[${symbol}] DB: ${total} mum | En eski: ${oldest} | En yeni: ${newest}`);

    // Eğer hiç veri yoksa full fetch yap
    if (!oldest || Number(total) === 0) {
      console.log(`[${symbol}] Hiç veri yok — tarihsel veri çekiliyor...`);
      await fetchHistorical(symbol, '1m', DAYS_HISTORY);
      return;
    }

    // En yeni veriden bu yana eksik mumları tamamla
    const newestMs = new Date(newest).getTime();
    const nowMs = Date.now();
    const gapMinutes = Math.floor((nowMs - newestMs) / 60000);

    if (gapMinutes > 1) {
      console.log(`[${symbol}] ${gapMinutes} dakika eksik veri var, dolduruluyor...`);
      const limit = Math.min(gapMinutes + 10, 1000);
      const klines = await fetchKlines(symbol, '1m', limit);

      if (klines && klines.length > 0) {
        const rows = klines
          .filter(k => k.time > newestMs)
          .map(k => ({
            symbol:    symbol.toUpperCase(),
            timestamp: new Date(k.time).toISOString().replace('T', ' ').slice(0, 23),
            open:      k.open,
            high:      k.high,
            low:       k.low,
            close:     k.close,
            volume:    k.volume,
          }));

        if (rows.length > 0) {
          await insert('market_data', rows);
          console.log(`✅ [${symbol}] ${rows.length} eksik mum eklendi`);
        }
      }
    } else {
      console.log(`✅ [${symbol}] Veri güncel`);
    }
  } catch (err) {
    console.error(`❌ fillGaps hatası (${symbol}):`, err.message);
  }
}

/**
 * Ana başlatma fonksiyonu — index.js'den çağrılır
 */
export async function runDataFetcher() {
  console.log('\n📦 DataFetcher başlatıldı...');
  for (const symbol of SYMBOLS) {
    await fillGaps(symbol);
  }
  console.log('✅ DataFetcher tamamlandı\n');
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
