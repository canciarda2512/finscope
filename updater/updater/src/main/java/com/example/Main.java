package com.example;

import com.clickhouse.client.api.Client;
import database.ClickhouseExecuter;
import database.Health;
import java.io.PrintWriter;
import java.net.Socket;
import java.time.LocalDateTime;
import java.time.Duration;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

public class Main {
    private static Socket calcSocket;
    private static Socket tgSocket;
    private static PrintWriter calcOut;
    private static PrintWriter tgOut;

    public static void main(String[] args) {
        final Client client = new Client.Builder()
                .addEndpoint("http://localhost:8123/")
                .setUsername("default")
                .setPassword("")
                .build();

        ClickhouseExecuter executer = new ClickhouseExecuter(client);
        Health health = new Health(executer);
        Sync sync = new Sync(executer);

        ScheduledExecutorService scheduler = Executors.newSingleThreadScheduledExecutor();

        Runnable task = () -> {
            boolean success = runPipeline(health, sync);
            String status = success ? "update:success" : "update:fail";
            
            notify(status);
        };

        long initialDelay = calculateInitialDelay();

        scheduler.scheduleAtFixedRate(task, initialDelay, 60, TimeUnit.SECONDS);
        
        System.out.println("service started, first run in " + initialDelay + " seconds");
    }

    private static boolean runPipeline(Health health, Sync sync) {
        int attempts = 0;
        boolean healthy = false;

        while (attempts < 2 && !healthy) {
            try {
                health.fastHealthCheck();
                healthy = true;

            } catch (Exception e) {
                attempts++;
                System.err.println("fast health check failed, (attempt " + attempts + "/3), cleaning up...");

                try {
                    health.deleteMessedupCoins();

                } catch (Exception ex) {
                    System.err.println("cleanup failed: " + ex.getMessage());
                }
            }
        }

        if (!healthy) return false;

        try {
            sync.syncAllToPresent();
            return true;

        } catch (Exception e) {
            e.printStackTrace();
            return false;
        }
    }

    private static long calculateInitialDelay() {
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime nextRun = now.withSecond(5).withNano(0).plusMinutes(now.getSecond() >= 5 ? 1 : 0);
        return Duration.between(now, nextRun).getSeconds();
    }

    private static void notify(String message) {
        sendToSocket(5000, message, "calc");
        sendToSocket(6001, message, "tg");
    }

    private static void sendToSocket(int port, String message, String type) {
        try {
            // Lazy initialization and Reconnection logic
            if (type.equals("calc")) {
                if (calcSocket == null || calcSocket.isClosed()) {
                    calcSocket = new Socket("localhost", port);
                    calcOut = new PrintWriter(calcSocket.getOutputStream(), true);
                }
                calcOut.println(message);
            } else {
                if (tgSocket == null || tgSocket.isClosed()) {
                    tgSocket = new Socket("localhost", port);
                    tgOut = new PrintWriter(tgSocket.getOutputStream(), true);
                }
                tgOut.println(message);
            }
        } catch (Exception e) {
            System.err.println("Socket error on port " + port + ": " + e.getMessage());
            closeSockets(); 
        }
    }

    private static void closeSockets() {
        try { if (calcSocket != null) calcSocket.close(); } catch (Exception e) {}
        try { if (tgSocket != null) tgSocket.close(); } catch (Exception e) {}
    }
}