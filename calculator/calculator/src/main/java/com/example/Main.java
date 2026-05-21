package com.example;

import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import com.clickhouse.client.api.Client;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.math.BigDecimal;
import java.net.ServerSocket;
import java.net.Socket;
import java.time.Instant;
import java.util.HashSet;

import database.ClickhouseExecuter;
import database.StreamType;
import logic.calculate.BarType;
import logic.calculate.Vault;
import logic.indicators.Rsi;
import shared.Candle;

public class Main {
    public static void main(String[] args) throws Exception{
        final Client client = new Client.Builder()
                .addEndpoint("http://localhost:8123/")
                .setUsername("default")
                .setPassword("")
                .build();

        final ClickhouseExecuter executer = new ClickhouseExecuter(client);

        try (ServerSocket serverSocket = new ServerSocket(5000)) {
            while (true) {
                try (Socket clientSocket = serverSocket.accept();
                        BufferedReader in = new BufferedReader(new InputStreamReader(clientSocket.getInputStream()))) {

                    String message = in.readLine();

                    if ("update:success".equals(message)) {
                        run(executer);

                    } else if ("update:fail".equals(message)) {
                        System.err.println("updater failed, not calculating");
                    }
                }
            }
        }

        //run(executer);
    }

    private static void run(ClickhouseExecuter executer) {
        ExecutorService executor = Executors.newFixedThreadPool(Runtime.getRuntime().availableProcessors());
        Map<String, List<Candle>> streamResult = executer.streamCandles(StreamType.ALL, "BTTCUSDT");

        long startTime = System.currentTimeMillis();

        for (String coin : streamResult.keySet()) {
            executor.submit(() -> {
                try {
                    List<Candle> candles = streamResult.get(coin);

                    if (candles != null) {
                        Vault vault = new Vault(candles);
                        vault.changeBarType(BarType.HEIKEN);
                        vault.setRsi(Rsi.calculateRSI(vault.getClose(), 14));

                    }

                } catch (Exception e) {
                    System.err.println("error processing " + coin + ": " + e.getMessage());
                    e.printStackTrace();
                }
            });
        }

        executor.shutdown();

        try {
            if (!executor.awaitTermination(5, TimeUnit.MINUTES)) {
                executor.shutdownNow();
            }

        } catch (InterruptedException e) {
            System.out.println("calculator executer shutdown failed");
            executor.shutdownNow();
        }

        long endTime = System.currentTimeMillis();
        System.out.println("total calculation time: " + (endTime - startTime) + "ms");
    }
}
