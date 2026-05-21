package shared;

import java.time.format.DateTimeFormatter;
import java.time.LocalDateTime;
import java.time.ZoneOffset;

public class TimeUtils {
    public static long convertToTimestamp(String dateStr, boolean returnMillis) {
        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
        LocalDateTime dateTime = LocalDateTime.parse(dateStr, formatter);
        long seconds = dateTime.toEpochSecond(ZoneOffset.UTC);
        return returnMillis ? (seconds * 1000) : seconds;
    }
}
