package database;

import java.util.ArrayList;
import java.util.List;

import com.fasterxml.jackson.databind.JsonNode;

public class Health {
    private final ClickhouseExecuter executer;

    public Health(ClickhouseExecuter executer) {
        this.executer = executer;
    }

    public void fastHealthCheck() {
        JsonNode fhcResult = executer.queryAsJson("fastHealthCheck");
        long fhcRowCount = fhcResult.get("rows").asLong();

        if (fhcRowCount != 1) {
            throw new RuntimeException("fast health check returned other than 1 row");
        }

        JsonNode ccResult = executer.queryAsJson("coinCount");
        long ccRowCount = ccResult.get("rows").asLong();

        if (ccRowCount != 1) {
            throw new RuntimeException("coin count returned other than 1 row");
        }

        if (fhcRowCount != ccRowCount) {
            throw new RuntimeException("coin count and fast health check row count mismatch");
        }

        System.out.println("fast health check is passed");
    }

    private List<String> getMessedUpCoins() {
        JsonNode diagnoseResult = this.executer.queryAsJson("messedUpCoins");

        List<String> symbolsToFix = new ArrayList<>();

        JsonNode dataNode = diagnoseResult.get("data");

        if (dataNode != null && dataNode.isArray()) {
            for (JsonNode row : dataNode) {
                JsonNode symbolNode = row.get("symbol");
                if (symbolNode != null) {
                    symbolsToFix.add(symbolNode.asText());
                }
            }
        }

        return symbolsToFix;
    }

    private void deleteSingleCoin(String symbolValue) {
        try {
            String part1Sql = ClickhouseUtils.loadQuery("deletePart1");
            String part1Final = part1Sql.replace("'${symbol}'", "'" + symbolValue + "'");
            JsonNode part1Res = executer.queryAsJsonRaw(part1Final);
            int rowCountToDelete = part1Res.get("data").get(0).get("rows_to_delete").asInt();

            if (!(rowCountToDelete > 0)) {
                throw new RuntimeException("no rows found for: " + symbolValue);
            }

            String part2Sql = ClickhouseUtils.loadQuery("deletePart2");
            String part2Final = part2Sql.replace("'${symbol}'", "'" + symbolValue + "'");

            executer.queryAsJsonRaw(part2Final);

            String part3Sql = ClickhouseUtils.loadQuery("deletePart3");
            String part3Final = part3Sql.replace("'${symbol}'", "'" + symbolValue + "'");
            JsonNode part3Res = executer.queryAsJsonRaw(part3Final);
            int remaining = part3Res.get("data").get(0).get("remaining").asInt();

            if (remaining != 0) {
                throw new RuntimeException(symbolValue + "için hala veri var, tam silinemedi");
            }

        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    public void deleteMessedupCoins() {
        try {
            List<String> messUpCoins = getMessedUpCoins();
            System.out.println(messUpCoins.size() + " mess up coins found, proceding with deletion");

            for (String string : messUpCoins) {
                System.out.println("deleting: " + string);
                deleteSingleCoin(string);
            }

            System.out.println("deleting done for all");

        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
