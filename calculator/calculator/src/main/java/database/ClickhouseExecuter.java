package database;

import com.clickhouse.client.api.data_formats.ClickHouseBinaryFormatReader;
import com.clickhouse.client.api.query.QueryResponse;
import com.clickhouse.client.api.Client;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.JsonNode;
import java.util.concurrent.TimeUnit;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.io.InputStream;
import shared.Candle;

public class ClickhouseExecuter {
    private final ObjectMapper mapper = new ObjectMapper();
    private final Client client;

    public ClickhouseExecuter(Client client) {
        this.client = client;
    }

    public JsonNode queryAsJson(String queryName) {
        String sql = ClickhouseUtils.loadQuery(queryName);
        String q = sql.trim();

        if (!q.toUpperCase().contains("FORMAT JSON;")) {
            throw new RuntimeException("query has bad format, expected json");
        }

        try (QueryResponse resp = this.client.query(q).get(30, TimeUnit.SECONDS);
                InputStream in = resp.getInputStream()) {

            return mapper.readTree(in);

        } catch (Exception e) {
            throw new RuntimeException("clickHouse json query failed", e);
        }
    }

    public Map<String, List<Candle>> streamCandles(StreamType streamType, String singleStreamSymbol) {
        String sql;

        switch (streamType) {
            case SINGLE -> {
                sql = ClickhouseUtils.loadQuery("streamSingleCandle");
                sql = sql.replace("'${symbol}'", "'" + singleStreamSymbol + "'");
            }
            case ALL -> {
                sql = ClickhouseUtils.loadQuery("streamAllCandles");
            }
            default -> throw new IllegalArgumentException("unsupported stream type: " + streamType);
        }

        Map<String, List<Candle>> marketData = new HashMap<>();
        long start = System.nanoTime();

        try (QueryResponse response = this.client.query(sql).get(30, TimeUnit.SECONDS)) {
            ClickHouseBinaryFormatReader reader = this.client.newBinaryFormatReader(response);

            while (reader.hasNext()) {
                reader.next();
                String sym = reader.getString("symbol");

                marketData.computeIfAbsent(sym, k -> new ArrayList<>(40000))
                        .add(new Candle(
                                sym,
                                reader.getLong("timestamp"),
                                reader.getDouble("open"),
                                reader.getDouble("high"),
                                reader.getDouble("low"),
                                reader.getDouble("close"),
                                reader.getDouble("volume")));
            }

            long end = System.nanoTime();
            System.out.printf("candle stream completed in %.3f ms%n", (end - start) / 1_000_000.0);
            return marketData;

        } catch (Exception e) {
            e.printStackTrace();
            return null;
        }
    }

    public static List<String> getCoinSymbols(ClickhouseExecuter executer) {
        JsonNode coinSymbolsRes = executer.queryAsJson("coinSymbols");

        List<String> symbols = new ArrayList<>();

        for (JsonNode row : coinSymbolsRes.path("data")) {
            String symbol = row.path("symbol").asText();
            if (!symbol.isEmpty()) {
                symbols.add(symbol);

            } else {
                System.out.println("empty field, wtf goin on");
            }
        }

        return symbols;
    }
}
