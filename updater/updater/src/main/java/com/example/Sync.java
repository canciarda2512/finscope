package com.example;

import java.util.concurrent.*;
import java.util.*;
import data.BinanceRaw;
import database.*;
import helpers.TimeHelpers;
import shared.Candle;
import com.fasterxml.jackson.databind.JsonNode;

public class Sync {
    private final ClickhouseExecuter executer;

    public Sync(ClickhouseExecuter executer) {
        this.executer = executer;
    }

    public void syncAllToPresent() throws Exception {
        JsonNode consensusResult = this.executer.queryAsJson("consensus");
        JsonNode consResultRow = consensusResult.get("data").get(0);
        long consensusEndTs = consResultRow.get("consensus_end_ts").asLong();

        long newStartTime = TimeHelpers.addOneMinute(consensusEndTs);
        long newEndTime = TimeHelpers.calculateClosedTimestamp1m();

        List<String> symbols = ClickhouseExecuter.getCoinSymbols(this.executer);
        ExecutorService executor = Executors.newFixedThreadPool(10);
        Queue<String> failed = new ConcurrentLinkedQueue<>();
        ConcurrentLinkedQueue<Candle> sink = new ConcurrentLinkedQueue<>();

        for (String coin : symbols) {
            executor.execute(() -> {
                try {
                    List<Candle> candles = BinanceRaw.getValidatedKlines(coin, newStartTime, newEndTime);

                    if (candles != null && !candles.isEmpty()) {
                        sink.addAll(candles);
                    }

                } catch (Exception e) {
                    System.err.println("CRITICAL ERROR ON " + coin + " : " + e.getMessage());
                    //e.printStackTrace();
                    failed.add(coin);
                }
            });
        }

        executor.shutdown();

        try {
            if (!executor.awaitTermination(30, TimeUnit.MINUTES)) {
                executor.shutdownNow();
            }
        } catch (InterruptedException e) {
            executor.shutdownNow();
            Thread.currentThread().interrupt();
        }

        List<Candle> allCandles = new ArrayList<>(sink.size());
        allCandles.addAll(sink);

        this.executer.writeCandles(allCandles);
        
        System.out.println("============================");
        System.out.println("total coin count to sync = " + symbols.size());
        System.out.println("consensus end time = " + TimeHelpers.convertToReadable(consensusEndTs));
        System.out.println("new start time = " + TimeHelpers.convertToReadable(newStartTime));
        System.out.println("new end time = " + TimeHelpers.convertToReadable(newEndTime));
        System.out.println("inserted candles = " + allCandles.size());
        System.out.println("failed coins = " + failed);
    }
}
