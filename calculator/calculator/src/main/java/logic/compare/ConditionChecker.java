package logic.compare;

public class ConditionChecker {
    private static final double TOLERANCE = 0.000001;

    private static boolean isValid(double[] a1, double[] a2, int n) {
        return a1 != null && a2 != null && a1.length >= n && a2.length >= n && a1.length == a2.length;
    }

    public static boolean check(double[] arr1, double[] arr2, int n, CompareType type) {
        if (!isValid(arr1, arr2, n))
            return false;

        int start = arr1.length - n;
        
        for (int i = start; i < arr1.length; i++) {
            if (!evaluate(arr1[i], arr2[i], type))
                return false;
        }
        return true;
    }

    public static boolean check(double[] arr, double value, int n, CompareType type) {
        if (arr == null || arr.length < n)
            return false;

        int start = arr.length - n;
        for (int i = start; i < arr.length; i++) {
            if (!evaluate(arr[i], value, type))
                return false;
        }
        return true;
    }

    private static boolean evaluate(double val, double target, CompareType type) {
        double padding = Math.abs(target) * TOLERANCE;

        return switch (type) {
            case GREATER_THAN ->
                val > (target - padding);

            case LESS_THAN ->
                val < (target + padding);

            case GREATER_THAN_OR_EQUAL ->
                val >= (target - padding);

            case LESS_THAN_OR_EQUAL ->
                val <= (target + padding);

            case EQUAL ->
                Math.abs(val - target) <= padding;

            case VALUE_GREATER_THAN ->
                val > (target - padding);

            case VALUE_LESS_THAN ->
                val < (target + padding);

            case VALUE_EQUAL ->
                Math.abs(val - target) <= padding;

            default -> throw new IllegalArgumentException("Unsupported type: " + type);
        };
    }
}