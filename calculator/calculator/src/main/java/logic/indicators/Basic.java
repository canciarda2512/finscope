package logic.indicators;

import java.util.Arrays;

public class Basic {
    public static double[] ema(double[] values, int period) {
        int n = values.length;
        double[] ema = new double[n];
        Arrays.fill(ema, Double.NaN);

        if (n == 0 || period <= 0)
            return ema;

        double alpha = 2.0 / (period + 1);

        int firstValid = -1;
        for (int i = 0; i < n; i++) {
            if (!Double.isNaN(values[i])) {
                firstValid = i;
                break;
            }
        }

        if (firstValid == -1) {
            return ema;
        }

        ema[firstValid] = values[firstValid];

        for (int i = firstValid + 1; i < n; i++) {
            if (Double.isNaN(values[i])) {
                ema[i] = ema[i - 1];
                
            } else {
                ema[i] = (values[i] - ema[i - 1]) * alpha + ema[i - 1];
            }
        }

        return ema;
    }

    public static double[] tr(double[] highs, double[] lows, double[] closes) {
        int n = closes.length;
        double[] tr = new double[n];
        Arrays.fill(tr, Double.NaN);

        for (int i = 1; i < n; i++) {
            if (Double.isNaN(highs[i]) || Double.isNaN(lows[i]) || Double.isNaN(closes[i - 1])) {
                continue;
            }

            double h = highs[i];
            double l = lows[i];
            double pc = closes[i - 1];

            tr[i] = Math.max(h - l, Math.max(Math.abs(h - pc), Math.abs(l - pc)));
        }

        return tr;
    }

    public static double[] atr(double[] tr, int period) {
        int n = tr.length;
        double[] atr = new double[n];
        Arrays.fill(atr, Double.NaN);

        if (n < 2 || period <= 0) {
            return atr;
        }

        int firstValid = -1;
        for (int i = 0; i < n; i++) {
            if (!Double.isNaN(tr[i])) {
                firstValid = i;
                break;
            }
        }

        if (firstValid == -1) {
            return atr;
        }

        double alpha = 1.0 / period;
        atr[firstValid] = tr[firstValid];

        for (int i = firstValid + 1; i < n; i++) {
            if (Double.isNaN(tr[i])) {
                atr[i] = atr[i - 1];

            } else {
                atr[i] = alpha * tr[i] + (1.0 - alpha) * atr[i - 1];
            }
        }

        return atr;
    }

    public static double[] sma(double[] src, int length) {
        int n = src.length;
        double[] sma = new double[n];
        java.util.Arrays.fill(sma, Double.NaN);

        if (n < length || length <= 0) {
            return sma;
        }

        double windowSum = 0;
        int validCount = 0;

        for (int i = 0; i < n; i++) {
            if (Double.isNaN(src[i])) {
                windowSum = 0;
                validCount = 0;
                continue;
            }

            windowSum += src[i];
            validCount++;

            if (validCount > length) {
                windowSum -= src[i - length];
            }

            if (validCount >= length) {
                sma[i] = windowSum / length;
            }
        }

        return sma;
    }
}