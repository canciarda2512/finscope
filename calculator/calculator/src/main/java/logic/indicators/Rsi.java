package logic.indicators;

public class Rsi {
    public static double[] calculateRSI(double[] close, int period) {
        double[] rsi = new double[close.length];

        if (close == null || close.length <= period) {
            java.util.Arrays.fill(rsi, Double.NaN);
            return rsi;
        }

        for (int i = 0; i <= period; i++) {
            rsi[i] = Double.NaN;
        }

        double sumGain = 0;
        double sumLoss = 0;


        for (int i = 1; i <= period; i++) {
            double change = close[i] - close[i - 1];
            if (change > 0) {
                sumGain += change;
            } else {
                sumLoss += Math.abs(change);
            }
        }

        double avgGain = sumGain / period;
        double avgLoss = sumLoss / period;

        if (avgLoss == 0) {
            rsi[period] = 100;
            
        } else if (avgGain == 0) {
            rsi[period] = 0;

        } else {
            double rs = avgGain / avgLoss;
            rsi[period] = 100 - (100 / (1 + rs));
        }


        double alpha = 1.0 / period;

        for (int i = period + 1; i < close.length; i++) {
            double change = close[i] - close[i - 1];
            double currentGain = change > 0 ? change : 0;
            double currentLoss = change < 0 ? Math.abs(change) : 0;

            avgGain = alpha * currentGain + (1 - alpha) * avgGain;
            avgLoss = alpha * currentLoss + (1 - alpha) * avgLoss;

            if (avgLoss == 0) {
                rsi[i] = 100;
            } else if (avgGain == 0) {
                rsi[i] = 0;
            } else {
                double rs = avgGain / avgLoss;
                rsi[i] = 100 - (100 / (1 + rs));
            }
        }

        return rsi;
    }
}
