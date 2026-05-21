package helpers;

import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.util.Locale;

public class TimeHelpers {
    private static final long ONE_MINUTE_MS = 60000L;

    public static String convertToReadable(Object timestampToConvert) {
        try {
            if (timestampToConvert == null) {
                return "[convertToReadable] no timestamp provided";
            }

            long timestampMs;

            try {
                timestampMs = Long.parseLong(timestampToConvert.toString());

            } catch (NumberFormatException e) {
                return "[convertToReadable] invalid date";
            }

            if (timestampMs < 1000000000000L) {
                return "[convertToReadable] received non-millisecond timestamp " + timestampMs;
            }

            Instant instant = Instant.ofEpochMilli(timestampMs);

            DateTimeFormatter formatter = DateTimeFormatter.ofPattern("dd.MM.yyyy HH:mm:ss 'UTC'")
                    .withZone(ZoneId.of("UTC"))
                    .withLocale(Locale.of("tr", "TR"));

            return formatter.format(instant);

        } catch (Exception error) {
            return "[convertToReadable] failed: " + error.getMessage();
        }
    }

    public static long addOneMinute(long timestamp) {
        return timestamp + ONE_MINUTE_MS;
    }

    public static long subtractOneMinute(long timestamp) {
        return timestamp - ONE_MINUTE_MS;
    }

    public static long calculateClosedTimestamp1m() {
        try {
            long nowMs = System.currentTimeMillis();

            if (nowMs < 1_000_000_000_000L) {
                throw new Exception("[calculateClosedTimestamp1m] environment clock error, expected ms, got " + nowMs);
            }
            long startOfCurrentMinuteUTC = (nowMs / ONE_MINUTE_MS) * ONE_MINUTE_MS;

            return startOfCurrentMinuteUTC - ONE_MINUTE_MS;

        } catch (Exception e) {
            System.err.println("[calculateClosedTimestamp1m] " + e.getMessage());
            return -1;
        }
    }

    public static long[] createStartEndTimestamps(int amountToSubtract, ChronoUnit unit) {
        try {
            long[] results = new long[2];
            long end = calculateClosedTimestamp1m();

            ZonedDateTime endTime = Instant.ofEpochMilli(end).atZone(ZoneOffset.UTC);
            
            long start = endTime.minus(amountToSubtract, unit).toInstant().toEpochMilli();

            results[0] = start;
            results[1] = end;

            return results;

        } catch (Exception e) {
            System.err.println("[createStartEndTimestamps] failed: " + e.getMessage());
            return new long[0];
        }
    }

    public static long convertToMs(String datetimeString) {
        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss.SSS");

        LocalDateTime ldt = LocalDateTime.parse(datetimeString, formatter);

        long epochMs = ldt
                .atZone(ZoneId.of("UTC"))
                .toInstant()
                .toEpochMilli();

        return epochMs;
    }
}
