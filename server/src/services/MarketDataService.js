import { fetchKlines } from './BinanceService.js'
import db from './ClickHouseClient.js'

/**
 * Belirtilen sembol için market verilerini Binance'den çeker ve 
 * ClickHouse'a (finscope.market_data) kaydeder.
 */
export async function syncMarketData(symbol) {
  try {
    console.log(`\n[${symbol}] Market verisi senkronizasyonu başlıyor...`)

    // 1. Veritabanındaki en son başarılı tarihe bak
    // db.query fonksiyonun format: JSONEachRow'u otomatik ekliyor.
    const result = await db.query(
      `SELECT max(timestamp) AS last_ts FROM market_data WHERE symbol = {symbol:String}`,
      { symbol }
    )

    let lastTimestamp = 0
    const lastTs = result.rows?.[0]?.last_ts

    // Eğer veri varsa ve ClickHouse'un "boş" başlangıç tarihi (1970) değilse al
    if (lastTs && !lastTs.startsWith('1970-01-01')) {
      lastTimestamp = new Date(lastTs).getTime()
    }

    // 2. Binance'den son 1000 mumu çek
    const klines = await fetchKlines(symbol, '1m', 1000)
    if (!klines || !klines.length) {
      console.log(`⚠️  ${symbol} için Binance verisi alınamadı.`)
      return
    }

    // 3. Verileri dönüştür ve sadece yeni olanları filtrele
    const rows = klines
      .map(k => ({
        symbol,
        // ClickHouse DateTime tipi için en güvenli format: YYYY-MM-DD HH:mm:ss
        timestamp: new Date(k.time).toISOString().slice(0, 19).replace('T', ' '),
        open: Number(k.open),
        high: Number(k.high),
        low: Number(k.low),
        close: Number(k.close),
        volume: Number(k.volume),
        _rawTime: k.time // Sadece filtreleme için kullanıyoruz
      }))
      .filter(row => row._rawTime > lastTimestamp)

    if (rows.length === 0) {
      console.log(`✅ ${symbol} zaten güncel.`)
      return
    }

    // 4. ClickHouse'a gönder (Gereksiz _rawTime alanını çıkararak)
    const finalRows = rows.map(({ _rawTime, ...data }) => data)
    
    // Senin ClickHouseClient.js dosyanın beklediği parametre yapısı: (table, rows)
    await db.insert('market_data', finalRows)
    
    console.log(`✅ ${symbol} → ${finalRows.length} yeni mum veritabanına başarıyla işlendi.`)

  } catch (error) {
    console.error(`❌ MarketDataService Hatası [${symbol}]:`, error.message)
  }
}