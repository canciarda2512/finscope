package database;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.util.List;
import shared.Candle;

public class ClickhouseUtils {
    private static void writeVarInt(ByteArrayOutputStream out, int v) {
        while ((v & 0xFFFFFF80) != 0L) {
            out.write((v & 0x7F) | 0x80);
            v >>>= 7;
        }
        out.write(v & 0x7F);
    }

    public static InputStream convertToStream(List<Candle> candles) throws Exception {
        ByteArrayOutputStream out = new ByteArrayOutputStream();

        for (Candle c : candles) {

            byte[] symBytes = c.symbol().getBytes(StandardCharsets.UTF_8);
            writeVarInt(out, symBytes.length);

            out.write(symBytes);
            out.write(ByteBuffer.allocate(8).order(ByteOrder.LITTLE_ENDIAN).putLong(c.timestamp()).array());
            out.write(ByteBuffer.allocate(8).order(ByteOrder.LITTLE_ENDIAN).putDouble(c.open()).array());
            out.write(ByteBuffer.allocate(8).order(ByteOrder.LITTLE_ENDIAN).putDouble(c.high()).array());
            out.write(ByteBuffer.allocate(8).order(ByteOrder.LITTLE_ENDIAN).putDouble(c.low()).array());
            out.write(ByteBuffer.allocate(8).order(ByteOrder.LITTLE_ENDIAN).putDouble(c.close()).array());
            out.write(ByteBuffer.allocate(8).order(ByteOrder.LITTLE_ENDIAN).putDouble(c.volume()).array());
        }

        return new ByteArrayInputStream(out.toByteArray());
    }

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
