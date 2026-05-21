package database;

import java.io.IOException;
import java.io.InputStream;

public class ClickhouseUtils {
    public static String loadQuery(String fileName) {
        try (InputStream inStream = ClickhouseExecuter.class.getClassLoader()
                .getResourceAsStream("sql/" + fileName + ".sql")) {
            if (inStream == null) {
                throw new IOException("[loadQuery] FAILED query file not found: " + fileName);
            }
            return new String(inStream.readAllBytes(), java.nio.charset.StandardCharsets.UTF_8);

        } catch (IOException e) {
            System.err.println("[loadQuery] FAILED cant load sql: " + e.getMessage());
            return null;
        }
    }
}
