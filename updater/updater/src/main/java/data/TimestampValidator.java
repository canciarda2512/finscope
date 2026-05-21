package data;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import helpers.TimeHelpers;
import shared.Candle;

public class TimestampValidator {
    private static final long INTERVAL_MS = 60000;

    private static void validatePrecision(long ts, String label, List<String> errors) {
        if (ts < 1_000_000_000_000L) {
            errors.add(label + " precision error: Expected 13-digit MS but got " + ts);
        }
    }

    public static List<String> validateTimestamps(List<Candle> candles, long expectedStart, long expectedEnd) {
        List<String> errors = new ArrayList<>();

        if (candles == null || candles.isEmpty()) {
            return List.of("list is empty or null.");
        }

        validatePrecision(expectedStart, "expectedStart", errors);
        validatePrecision(expectedEnd, "expectedEnd", errors);

        long firstTs = candles.get(0).timestamp();
        long lastTs = candles.get(candles.size() - 1).timestamp();

        validatePrecision(firstTs, "firstCandle TS", errors);

        if (firstTs != expectedStart) {
            errors.add("start mismatch: expected " + TimeHelpers.convertToReadable(expectedStart) + ", got "
                    + TimeHelpers.convertToReadable(firstTs));
        }
        if (lastTs != expectedEnd) {
            errors.add("finish mismatch: expected " + TimeHelpers.convertToReadable(expectedEnd) + ", got "
                    + TimeHelpers.convertToReadable(lastTs));
        }

        Set<Long> seen = new HashSet<>();
        seen.add(firstTs);

        for (int i = 1; i < candles.size(); i++) {
            long current = candles.get(i).timestamp();
            long previous = candles.get(i - 1).timestamp();

            if (!seen.add(current)) {
                errors.add("duplicate found at index " + i + ": " + current);
            }

            long diff = current - previous;
            if (diff != INTERVAL_MS) {
                String prevDate = Instant.ofEpochMilli(previous).toString();
                String currDate = Instant.ofEpochMilli(current).toString();
                errors.add("gap found! " + prevDate + " to " + currDate + " jump: " + (diff / INTERVAL_MS) + " min");
            }
        }
        return errors;
    }
}
