package logic.calculate;

import java.math.BigDecimal;

public class Scaler {
    public static double calculateScaleFactor(double price) {
        if (price >= 1.0 || price <= 0) {
            return 1;
        }

        String priceStr = BigDecimal.valueOf(price).toPlainString();
        int dotIndex = priceStr.indexOf('.');

        if (dotIndex == -1) {
            return 0;
        }

        int zeroCount = 0;

        for (int i = dotIndex + 1; i < priceStr.length(); i++) {
            if (priceStr.charAt(i) == '0') {
                zeroCount++;

            } else {
                break;
            }
        }

        return switch (zeroCount) {
            case 0, 1, 2 -> 1.0;
            case 3, 4 -> 1_000.0;
            case 5, 6 -> 1_000_000.0;
            case 7, 8 -> 1_000_000_000.0;
            default -> 10_000_000_000.0;
        };
    }
}
