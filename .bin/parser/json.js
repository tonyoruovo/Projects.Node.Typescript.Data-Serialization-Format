import parser from "./parser.js";
var json;
(function (json) {
    /**
     * Tests whether the argument is not an object/array
     * @param {any} data the value to be tested
     * @returns {boolean} `true` if the argument is not an object/array otherwise returns `false`
     */
    function isAtomic(data) {
        return (data === null || (typeof data !== "object" && !Array.isArray(data)));
    }
    json.isAtomic = isAtomic;
    /**
     * Checks if the array contains exclusively atomic values (as specified by {@link json.Atom `json.Atom`}) and return `true` if it is, else returns `false`.
     * @param {any[]} array an array
     * @returns {boolean} `true` if the argument does not contain an array/object otherwise `false`
     */
    function arrayIsAtomic(array) {
        for (let i = 0; i < array.length; i++) {
            if (!isAtomic(array[i]))
                return false;
        }
        return true;
    }
    json.arrayIsAtomic = arrayIsAtomic;
    /**
     * A converter that accepts {@link expression.Expression} objects and outputs in-memory json
     * @template S the {@link Syntax} to use during conversion
     * @template P a mutable parameter object
     * @template F a type of {@link GFormat} that actually does the conversion, provided by the users of this class
     */
    class Converter extends parser.AbstractConverter {
        format;
        constructor(syntax, params, format, options = {
            readableObjectMode: true,
            writableObjectMode: true
        }) {
            super({
                ...options,
                allowHalfOpen: true,
                objectMode: true
            }, syntax, params);
            this.format = format;
        }
        /**
         * @inheritdoc
         */
        _transform(chunk, encoding, callback) {
            try {
                chunk.format(this.format, this.syntax, this.params);
                // const array = this.format.data() as Pair[];
                // console.log(array);
                return callback();
            }
            catch (e) {
                return callback(e);
            }
        }
        /**
         * @inheritdoc
         */
        _flush(callback) {
            this.push(this.format.data());
            callback();
        }
    }
    json.Converter = Converter;
})(json || (json = {}));
export default json;
