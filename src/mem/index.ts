import DataError from "./DataError";

const error = new DataError("This is a test error!", 0)

try {
    throw error
} catch (e) {
    console.error("DataError", e)
}
