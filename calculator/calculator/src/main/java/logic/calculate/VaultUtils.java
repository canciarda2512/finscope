package logic.calculate;

import java.util.LinkedHashMap;
import java.util.Collections;
import java.util.Arrays;
import java.util.Map;

public class VaultUtils {
    public static Map<String, Object> getDataBetween(Vault vault, double startSec, double endSec) {
        long startMs = Math.round(startSec * 1000.0);
        long endMs = Math.round(endSec * 1000.0);

        if (vault.getTimestamp() == null || vault.getTimestamp().length == 0) {
            return Collections.emptyMap();
        }

        int startIndex = Arrays.binarySearch(vault.getTimestamp(), startMs);

        if (startIndex < 0) {
            startIndex = -(startIndex + 1);
        }

        int endIndex = Arrays.binarySearch(vault.getTimestamp(), endMs);

        if (endIndex < 0) {
            endIndex = -(endIndex + 1) - 1;
        }

        if (startIndex > endIndex || startIndex >= vault.getTimestamp().length || endIndex < 0) {
            return Collections.emptyMap();
        }

        int toIndex = endIndex + 1;
        Map<String, Object> result = new LinkedHashMap<>();

        result.put("timestamp", Arrays.copyOfRange(vault.getTimestamp(), startIndex, toIndex));
        result.put("open", Arrays.copyOfRange(vault.getOpen(), startIndex, toIndex));
        result.put("high", Arrays.copyOfRange(vault.getHigh(), startIndex, toIndex));
        result.put("low", Arrays.copyOfRange(vault.getLow(), startIndex, toIndex));
        result.put("close", Arrays.copyOfRange(vault.getClose(), startIndex, toIndex));
        result.put("volume", Arrays.copyOfRange(vault.getVolume(), startIndex, toIndex));
        result.put("rsi", Arrays.copyOfRange(vault.getRsi(), startIndex, toIndex));
        
        return result;
    }
}
