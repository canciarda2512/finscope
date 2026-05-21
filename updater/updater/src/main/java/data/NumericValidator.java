package data;

import java.util.ArrayList;
import java.util.List;
import shared.Candle;

public class NumericValidator {
    private static void checkField(double value, String key, int index, List<String> errors) {
        if (!Double.isFinite(value)) {
            errors.add("key '" + key + "' at index " + index + " is not a valid number (value: " + value + ")");
        }
    }

    public static List<String> validateNumerics(List<Candle> candles) {
        List<String> errors = new ArrayList<>();

        if (candles == null || candles.isEmpty()) {
            errors.add("input data list is empty or null.");
            return errors;
        }

        for (int i = 0; i < candles.size(); i++) {
            Candle obj = candles.get(i);

            if (obj == null) {
                errors.add("blank object found at index " + i + ".");
                continue;
            }

            if (obj.symbol() == null || obj.symbol().isBlank()) {
                errors.add("key 'symbol' at index " + i + " is missing or blank.");
            }

            checkField(obj.open(), "open", i, errors);
            checkField(obj.high(), "high", i, errors);
            checkField(obj.low(), "low", i, errors);
            checkField(obj.close(), "close", i, errors);
            checkField(obj.volume(), "volume", i, errors);
        }

        return errors;
    }
}