package database;

import java.io.InputStream;
import java.util.concurrent.TimeUnit;
import java.util.ArrayList;
import java.util.List;
import com.clickhouse.client.api.insert.InsertResponse;
import com.clickhouse.client.api.metrics.ServerMetrics;
import com.clickhouse.client.api.metadata.TableSchema;
import com.clickhouse.client.api.query.QueryResponse;
import com.clickhouse.client.api.Client;
import com.clickhouse.data.ClickHouseFormat;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.JsonNode;

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
            throw new RuntimeException("ClickHouse JSON query failed", e);
        }
    }

    public JsonNode queryAsJsonRaw(String sql) {
        String q = sql.trim();

        if (!q.toUpperCase().contains("FORMAT JSON;")) {
            throw new RuntimeException("query has bad format, expected json");
        }

        try (QueryResponse resp = this.client.query(q).get(30, TimeUnit.SECONDS);
                InputStream in = resp.getInputStream()) {

            return mapper.readTree(in);

        } catch (Exception e) {
            throw new RuntimeException("ClickHouse JSON query failed", e);
        }
    }

    public void writeCandles(List<Candle> candles) {
        try {
            TableSchema schema = this.client.getTableSchema("finscope.market_data");
            this.client.register(Candle.class, schema);

            long start = System.currentTimeMillis();

            try (InputStream dataStream = ClickhouseUtils.convertToStream(candles)) {
                try (InsertResponse response = this.client
                        .insert("finscope.market_data", dataStream, ClickHouseFormat.RowBinary)
                        .get(30, TimeUnit.SECONDS)) {

                    System.out.println(response.getMetrics().getMetric(ServerMetrics.NUM_ROWS_WRITTEN).getLong());

                } catch (Exception e) {
                    System.out.println("failed to write data" + e);
                    throw new RuntimeException(e);
                }
            }

            long duration = System.currentTimeMillis() - start;
            System.out.println("time taken to write to database: " + duration + " ms");

        } catch (Exception e) {
            e.printStackTrace();
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
