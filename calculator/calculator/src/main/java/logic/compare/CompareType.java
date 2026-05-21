package logic.compare;

public enum CompareType {
    GREATER_THAN,
    LESS_THAN,
    GREATER_THAN_OR_EQUAL,
    LESS_THAN_OR_EQUAL,
    EQUAL,
    // Scalar versions (Array vs. a single Value)
    VALUE_GREATER_THAN,
    VALUE_LESS_THAN,
    VALUE_EQUAL
}