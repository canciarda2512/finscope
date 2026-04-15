import { useEffect, useState, useRef } from 'react';
import { createChart } from 'lightweight-charts';
import { MousePointer2, Minus, TrendingUp, Search } from 'lucide-react';
import { generateMockCandles } from '../services/mockData';

const TIMEFRAMES = ['5m', '1H', '1D', '1W', '1M'];

export default function ChartPage() {
  const [timeframe, setTimeframe] = useState('5m');
  const [activeTool, setActiveTool] = useState('cursor');
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const candleSeriesRef = useRef(null);
  const toolRef = useRef('cursor');

  useEffect(() => {
    toolRef.current = activeTool;
  }, [activeTool]);

  const processData = (data) => {
    return data
      .sort((a, b) => a.time - b.time)
      .filter((value, index, self) => 
        index === self.findIndex((t) => t.time === value.time)
      );
  };

  const renderChart = (rawData) => {
    if (!chartContainerRef.current) return;
    const container = chartContainerRef.current;
    container.innerHTML = '';

    const chart = createChart(container, {
      width: container.clientWidth,
      height: 450,
      layout: { background: { color: '#0f172a' }, textColor: '#94a3b8' },
      grid: { vertLines: { color: '#1e293b' }, horzLines: { color: '#1e293b' } },
      timeScale: { borderColor: '#334155', timeVisible: true },
    });

    const series = chart.addCandlestickSeries({
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    });

    const cleanData = processData(rawData);
    series.setData(cleanData);
    chart.timeScale().fitContent();
    candleSeriesRef.current = series;
    chartRef.current = chart;

    chart.subscribeClick((param) => {
      if (param.point && toolRef.current === 'hline') {
        const price = candleSeriesRef.current.coordinateToPrice(param.point.y);
        if (price) {
          candleSeriesRef.current.createPriceLine({
            price,
            color: '#3b82f6',
            lineWidth: 2,
            title: `Lvl ${price.toFixed(2)}`,
          });
          setActiveTool('cursor');
        }
      }
    });
  };

  useEffect(() => {
    const rawData = generateMockCandles(200, timeframe);
    renderChart(rawData);
    const handleResize = () => {
      if (chartRef.current && chartContainerRef.current) {
        chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      if (chartRef.current) chartRef.current.remove();
    };
  }, [timeframe]);

  return (
    <div className="bg-[#020617] min-h-screen text-slate-300 font-sans pb-12">
      <div className="flex flex-col lg:flex-row p-4 gap-4 max-w-[1600px] mx-auto">
        
        {/* SOL PANEL: CHART & LISTS */}
        <div className="flex-1 flex flex-col gap-4">
          
          {/* CHART CONTROLS */}
          <div className="bg-[#0f172a] p-3 rounded-xl border border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h2 className="text-white font-bold text-lg flex items-center gap-2">
                BTC/USDT <span className="text-green-500 text-sm font-normal">+2.34%</span>
              </h2>
              <div className="flex bg-slate-950 rounded-lg p-1 gap-1 border border-slate-800">
                {TIMEFRAMES.map(tf => (
                  <button 
                    key={tf} 
                    onClick={() => setTimeframe(tf)} 
                    className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${timeframe === tf ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                    {tf}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
              <button onClick={() => setActiveTool('cursor')} className={`p-2 rounded-md transition-all ${activeTool === 'cursor' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-white'}`}>
                <MousePointer2 size={18}/>
              </button>
              <button onClick={() => setActiveTool('hline')} className={`p-2 rounded-md transition-all ${activeTool === 'hline' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-white'}`}>
                <Minus size={18}/>
              </button>
            </div>
          </div>

          {/* CHART CONTAINER */}
          <div className="bg-[#0f172a] rounded-xl border border-slate-800 p-2 shadow-2xl overflow-hidden min-h-[460px]">
            <div ref={chartContainerRef} className="w-full h-full" />
          </div>

          {/* LOWER LISTS */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-[#0f172a] rounded-xl border border-slate-800 p-4">
              <h3 className="text-[10px] font-bold uppercase text-slate-500 mb-4 tracking-widest">Limit Orders</h3>
              <div className="space-y-2">
                <div className="flex justify-between items-center text-sm bg-slate-950 p-3 rounded-lg border-l-4 border-green-500">
                  <div className="flex flex-col">
                    <span className="font-bold">BUY BTC</span>
                    <span className="text-[10px] text-slate-500">$65,000.00</span>
                  </div>
                  <span className="text-blue-400 cursor-pointer text-xs font-bold">Cancel</span>
                </div>
              </div>
            </div>

            <div className="bg-[#0f172a] rounded-xl border border-slate-800 p-4">
              <h3 className="text-[10px] font-bold uppercase text-slate-500 mb-4 tracking-widest">Positions</h3>
              <div className="flex justify-between items-center text-sm bg-slate-950 p-4 rounded-lg border border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-orange-500/10 rounded-full flex items-center justify-center text-orange-500 font-bold text-xs">B</div>
                  <div>
                    <p className="font-bold">BTC/USDT</p>
                    <p className="text-[10px] text-slate-500">Long • 0.05 BTC</p>
                  </div>
                </div>
                <span className="text-green-500 font-bold">+$412.50</span>
              </div>
            </div>
          </div>
        </div>

        {/* SAĞ PANEL: ORDER & WATCHLIST */}
        <div className="w-full lg:w-80 flex flex-col gap-4">
          <div className="bg-[#0f172a] rounded-xl border border-slate-800 p-5 shadow-lg">
            <h3 className="text-white font-bold mb-4 text-sm">Order Panel</h3>
            <div className="flex bg-slate-950 rounded-xl p-1 mb-6 border border-slate-800">
              <button className="flex-1 py-2 rounded-lg bg-green-600 text-white text-xs font-bold shadow-lg shadow-green-900/20">Buy</button>
              <button className="flex-1 py-2 rounded-lg text-slate-500 text-xs font-bold">Sell</button>
            </div>
            <div className="space-y-4">
              <div className="relative">
                <label className="text-[9px] uppercase font-bold text-slate-500 absolute -top-2 left-3 bg-[#0f172a] px-1">Amount (USDT)</label>
                <input type="number" defaultValue="1000" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 transition" />
              </div>
              <div className="relative">
                <label className="text-[9px] uppercase font-bold text-slate-500 absolute -top-2 left-3 bg-[#0f172a] px-1">Limit Price</label>
                <input type="number" defaultValue="64000" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 transition" />
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-500">Balance:</span>
                  <span className="text-white font-bold">$95,235.00</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-500">Est. BTC:</span>
                  <span className="text-white font-bold">0.0156 BTC</span>
                </div>
              </div>
              <button className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-green-900/30">
                Buy BTC
              </button>
            </div>
          </div>

          <div className="bg-[#0f172a] rounded-xl border border-slate-800 p-5">
            <h3 className="text-[10px] font-bold uppercase text-slate-500 mb-4 tracking-widest flex justify-between">Watch List <Search size={14}/></h3>
            <div className="space-y-4">
              {[
                { s: 'BTC', p: '67,432', c: '+2.34%', up: true },
                { s: 'ETH', p: '3,541', c: '+1.12%', up: true },
                { s: 'SOL', p: '142.50', c: '-0.87%', up: false }
              ].map(coin => (
                <div key={coin.s} className="flex justify-between items-center text-xs">
                  <span className="font-bold">{coin.s}</span>
                  <span className="font-mono text-slate-400">${coin.p}</span>
                  <span className={`font-bold ${coin.up ? 'text-green-500' : 'text-red-500'}`}>{coin.c}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* FOOTER STATUS BAR */}
      <footer className="border-t border-slate-800 bg-[#0f172a] px-6 py-2 flex justify-between items-center text-[10px] text-slate-500 font-mono fixed bottom-0 w-full">
        <div className="flex gap-4">
          <span className="flex items-center gap-1"><div className="w-1 h-1 bg-green-500 rounded-full animate-pulse"></div> 12ms 11,247,832 rows scanned</span>
          <span className="text-amber-500">⚠️ 2 anomalies detected</span>
        </div>
        <span className="text-blue-400">Upward trend - 73% confidence</span>
      </footer>
    </div>
  );
}