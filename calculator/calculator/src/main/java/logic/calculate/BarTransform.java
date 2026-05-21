package logic.calculate;

public class BarTransform {
    public static double[][] transToHeiken(double[] open, double[] high, double[] low, double[] close) {
        int n = close.length;

        if (n == 0) {
            return new double[0][0];
        }

        double[] haOpen = new double[n];
        double[] haHigh = new double[n];
        double[] haLow = new double[n];
        double[] haClose = new double[n];

        haClose[0] = (open[0] + high[0] + low[0] + close[0]) / 4.0;
        haOpen[0] = (open[0] + close[0]) / 2.0;
        haHigh[0] = Math.max(high[0], Math.max(haOpen[0], haClose[0]));
        haLow[0] = Math.min(low[0], Math.min(haOpen[0], haClose[0]));

        for (int i = 1; i < n; i++) {
            haClose[i] = (open[i] + high[i] + low[i] + close[i]) / 4.0;
            haOpen[i] = (haOpen[i - 1] + haClose[i - 1]) / 2.0;
            haHigh[i] = Math.max(high[i], Math.max(haOpen[i], haClose[i]));
            haLow[i] = Math.min(low[i], Math.min(haOpen[i], haClose[i]));
        }

        return new double[][] { haOpen, haHigh, haLow, haClose };
    }
}
