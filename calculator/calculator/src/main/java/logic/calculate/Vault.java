package logic.calculate;

import java.util.List;
import shared.Candle;

public class Vault {
    // core values
    private String symbol;
    private long[] timestamp;
    private double[] open;
    private double[] high;
    private double[] low;
    private double[] close;
    private double[] volume;
    // calculation results
    private double[] macdLine;
    private double[] macdSignal;
    private double[] macdHistogram;
    private double[] sma;
    private double[] rsi;
    // precision
    private final double scaleFactor;

    public Vault(List<Candle> candles) {
        if (candles == null || candles.isEmpty()) {
            throw new IllegalArgumentException("candles cannot be null or empty");
        }

        int n = candles.size();

        this.symbol = candles.get(0).symbol();
        this.scaleFactor = Scaler.calculateScaleFactor(candles.get(n - 1).close());

        this.timestamp = new long[n];
        this.open = new double[n];
        this.high = new double[n];
        this.low = new double[n];
        this.close = new double[n];
        this.volume = new double[n];

        for (int i = 0; i < n; i++) {
            Candle c = candles.get(i);
            timestamp[i] = c.timestamp();
            this.open[i] = c.open() * this.scaleFactor;
            this.high[i] = c.high() * this.scaleFactor;
            this.low[i] = c.low() * this.scaleFactor;
            this.close[i] = c.close() * this.scaleFactor;
            this.volume[i] = c.volume();
        }
    }

    public void changeBarType(BarType barType) {
        switch (barType) {
            case HEIKEN -> {
                double[][] haData = BarTransform.transToHeiken(this.open, this.high, this.low, this.close);

                this.open = haData[0];
                this.high = haData[1];
                this.low = haData[2];
                this.close = haData[3];
            }
            default -> throw new IllegalArgumentException("unsupported bar type: " + barType);
        }
    }

    public String getSymbol() {
        return symbol;
    }

    public void setSymbol(String symbol) {
        this.symbol = symbol;
    }

    public long[] getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(long[] timestamp) {
        this.timestamp = timestamp;
    }

    public double[] getOpen() {
        return open;
    }

    public void setOpen(double[] open) {
        this.open = open;
    }

    public double[] getHigh() {
        return high;
    }

    public void setHigh(double[] high) {
        this.high = high;
    }

    public double[] getLow() {
        return low;
    }

    public void setLow(double[] low) {
        this.low = low;
    }

    public double[] getClose() {
        return close;
    }

    public void setClose(double[] close) {
        this.close = close;
    }

    public double[] getVolume() {
        return volume;
    }

    public void setVolume(double[] volume) {
        this.volume = volume;
    }

    public double[] getMacdLine() {
        return macdLine;
    }

    public void setMacdLine(double[] macdLine) {
        this.macdLine = macdLine;
    }

    public double[] getMacdSignal() {
        return macdSignal;
    }

    public void setMacdSignal(double[] macdSignal) {
        this.macdSignal = macdSignal;
    }

    public double[] getMacdHistogram() {
        return macdHistogram;
    }

    public void setMacdHistogram(double[] macdHistogram) {
        this.macdHistogram = macdHistogram;
    }

    public double[] getSma() {
        return sma;
    }

    public void setSma(double[] sma) {
        this.sma = sma;
    }

    public double getScaleFactor() {
        return scaleFactor;
    }

    public double[] getRsi() {
        return rsi;
    }

    public void setRsi(double[] rsi) {
        this.rsi = rsi;
    }

}
