package data;

import java.net.http.HttpResponse;
import java.net.http.HttpRequest;
import java.net.http.HttpClient;
import java.net.URI;
import java.util.ArrayList;
import java.util.List;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.JsonNode;

import shared.Candle;

public class BinanceRaw {
    private static final String baseUrl = "https://api.binance.com/api/v3/klines";
    private static final HttpClient httpClient = HttpClient.newHttpClient();
    private static final ObjectMapper objectMapper = new ObjectMapper();

    private static List<Candle> getKlines(String symbol, long startTime, long endTime) {
        List<Candle> allKlines = new ArrayList<>();
        long currentTime = startTime;
        int limit = 1000;

        if (startTime >= endTime) {
            System.out.println("[getCandleSingleCoin] startTime is greater than or equal to endTime");
            return List.of();
        }

        try {
            while (currentTime < endTime) {
                String url = "%s?symbol=%s&interval=1m&startTime=%d&endTime=%d&limit=%d"
                        .formatted(baseUrl, symbol.toUpperCase(), currentTime, endTime, limit);

                HttpRequest request = HttpRequest.newBuilder().uri(URI.create(url)).GET().build();

                HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

                if (response.statusCode() != 200) {
                    System.err.println("[getCandleSingleCoin] binance sent bad status code " + response.body());
                    break;
                }

                JsonNode data = objectMapper.readTree(response.body());
                if (data.isEmpty())
                    break;

                for (JsonNode k : data) {
                    allKlines.add(new Candle(
                            symbol, // symbol
                            k.get(0).asLong(), // timestamp
                            k.get(1).asDouble(), // open
                            k.get(2).asDouble(), // high
                            k.get(3).asDouble(), // low
                            k.get(4).asDouble(), // close
                            k.get(5).asDouble() // volume
                    ));
                }

                if (data.size() < limit)
                    break;

                currentTime = data.get(data.size() - 1).get(0).asLong() + 1;
            }

        } catch (Exception e) {
            System.err.println("[getCandleSingleCoin] failed " + e.getMessage());
        }

        return allKlines;
    }

    public static List<Candle> getValidatedKlines(String symbol, long startTime, long endTime) throws Exception{
        List<Candle> coinData = getKlines(symbol, startTime, endTime);
        List<String> timestampErrors = TimestampValidator.validateTimestamps(coinData, startTime, endTime);
        List<String> numericErrors = NumericValidator.validateNumerics(coinData);

        if(!timestampErrors.isEmpty()){
            throw new RuntimeException("timestamp validation failed for " + symbol);
        }

        if(!numericErrors.isEmpty()){
            throw new RuntimeException("numeric validation failed for " + symbol);
        }
        return coinData;
    }
}
