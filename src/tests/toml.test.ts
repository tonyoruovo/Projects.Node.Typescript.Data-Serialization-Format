import { EOL } from "os";
import toml from "../parser/toml.js";
import { log, table } from "console";
import parser from "../parser/parser.js";

// const data = `"127.0.0.1" = "value"${EOL}"character encoding" = "value"${EOL}"ʎǝʞ" = "value"${EOL}'key2' = "value"${EOL}'quoted "value"' = "value"`;
// const data = `"" = "blank"     # VALID but discouraged${EOL}'' = 'blank'     # VALID but discouraged`;
// const data = `name = "Orange"${EOL}physical.color = "orange"${EOL}physical.shape = "round"${EOL}site."google.com" = true`;
// const data = `str = "I'm a string. \\"You can quote me\\". Name\\tJos\\u00E9\\nLocation\\tSF."`;
// const data = `str1 = """${EOL}Roses are red${EOL}Violets are blue"""`;
// const data = `str1 = """# On a Unix system, the above multi-line string will most likely be the same as:${EOL}str2 = "Roses are red\\nViolets are blue"${EOL}${EOL}# On a Windows system, it will most likely be equivalent to:${EOL}str3 = "Roses are red\\r\\nViolets are blue"`;
// const data = `# The following strings are byte-for-byte equivalent:${EOL}str1 = "The quick brown fox jumps over the lazy dog."${EOL}${EOL}str2 = """${EOL}The quick brown \\${EOL}${EOL}${EOL}fox jumps over \\${EOL}the lazy dog."""${EOL}${EOL}str3 = """\\${EOL}The quick brown \\${EOL}fox jumps over \\${EOL}the lazy dog.\\${EOL}"""`;
// const data = `str4 = """Here are two quotation marks: "". Simple enough."""${EOL}# str5 = """Here are three quotation marks: """."""  # INVALID${EOL}str5 = """Here are three quotation marks: ""\\"."""${EOL}str6 = """Here are fifteen quotation marks: ""\\"""\\"""\\"""\\"""\\"."""${EOL}${EOL}# "This," she said, "is just a pointless statement."${EOL}str7 = """"This," she said, "is just a pointless statement.""""`;
// const data = `# What you see is what you get.${EOL}winpath  = 'C:\\Users\\nodejs\\templates'${EOL}winpath2 = '\\\\ServerX\\admin$\\system32\\'${EOL}quoted   = 'Tom "Dubs" Preston-Werner'${EOL}regex    = '<\\i\\c*\\s*>'`;
// const data = `regex2 = '''I [dw]on't need \\d{2} apples'''${EOL}lines  = '''${EOL}The first newline is${EOL}trimmed in raw strings.${EOL}All other whitespace${EOL}is preserved.${EOL}'''`;
// const data = `quot15 = '''Here are fifteen quotation marks: """""""""""""""'''${EOL}${EOL}# apos15 = '''Here are fifteen apostrophes: ''''''''''''''''''  # INVALID${EOL}apos15 = "Here are fifteen apostrophes: '''''''''''''''"${EOL}${EOL}# 'That,' she said, 'is still pointless.'${EOL}str = ''''That,' she said, 'is still pointless.''''`;
// const data = `int1 = +99${EOL}int2 = 42${EOL}int3 = 0${EOL}int4 = -17`;
// const data = `int5 = 1_000${EOL}int6 = 5_349_221${EOL}int7 = 53_49_221  # Indian number system grouping${EOL}int8 = 1_2_3_4_5  # VALID but discouraged`;
// const data = `# hexadecimal with prefix \`0x\`${EOL}hex1 = 0xDEADBEEF${EOL}hex2 = 0xdeadbeef${EOL}hex3 = 0xdead_beef${EOL}${EOL}# octal with prefix \`0o\`${EOL}oct1 = 0o01234567${EOL}oct2 = 0o755 # useful for Unix file permissions${EOL}${EOL}# binary with prefix \`0b\`${EOL}bin1 = 0b11010110`;
// const data = `# fractional${EOL}flt1 = +1.0${EOL}flt2 = 3.1415${EOL}flt3 = -0.01${EOL}${EOL}# exponent${EOL}flt4 = 5e+22${EOL}flt5 = 1e06${EOL}flt6 = -2E-2${EOL}${EOL}# both${EOL}flt7 = 6.626e-34`;
// const data = `flt8 = 224_617.445_991_228`;
// const data = `bool1 = true${EOL}bool2 = false`;
// const data = `odt1 = 1979-05-27T07:32:00Z${EOL}odt2 = 1979-05-27T00:32:00-07:00${EOL}odt3 = 1979-05-27T00:32:00.999999-07:00`;
// const data = `odt4 = 1979-05-27 07:32:00Z`;
// const data = `ldt1 = 1979-05-27T07:32:00${EOL}ldt2 = 1979-05-27T00:32:00.999999`;
const data = `ld1 = 1979-05-27`;
// const data = `lt1 = 07:32:00${EOL}lt2 = 00:32:00.999999`;
// const data = `integers = [ 1, 2, 3 ]${EOL}colors = [ "red", "yellow", "green" ]${EOL}nested_arrays_of_ints = [ [ 1, 2 ], [3, 4, 5] ]${EOL}nested_mixed_array = [ [ 1, 2 ], ["a", "b", "c"] ]${EOL}string_array = [ "all", 'strings', """are the same""", '''type''' ]${EOL}${EOL}# Mixed-type arrays are allowed${EOL}numbers = [ 0.1, 0.2, 0.5, 1, 2, 5 ]${EOL}contributors = [${EOL}"Foo Bar <foo@example.com>",${EOL}{ name = "Baz Qux", email = "bazqux@example.com", url = "https://example.com/bazqux" }${EOL}]`;

const s = {
    eol: EOL,
    global: false,
    qnan: false,
    snan: false
} as toml.Syntax;

const l = new toml.StringLexer(s.eol);
// log(l.mill);
l.process(data, s, undefined as any);
// log(l.mill);
l.end(s, undefined as any);
// log(l.mill);
table(l.processed().map(x => ({
        val: x.value,
        type: getType(x.type),
        ls: x.lineStart,
        le: x.lineEnd,
        p: x.startPos,
        l: x.length
})));

function getType(t: parser.GType<string>){
    switch (t.id) {
        case '0':
            return `INIT --> ${t.precedence.toString(16)}`
        case '1':
            return `EOL --> ${t.precedence.toString(16)}`
        case '2':
            return `HASH --> ${t.precedence.toString(16)}`
        case '3':
            return `QUOTE --> ${t.precedence.toString(16)}`
        case '4':
            return `TRI_QUOTE --> ${t.precedence.toString(16)}`
        case '5':
            return `D_QUOTE --> ${t.precedence.toString(16)}`
        case '6':
            return `TRI_D_QUOTE --> ${t.precedence.toString(16)}`
        case '7':
            return `TEXT --> ${t.precedence.toString(16)}`
        case '8':
            return `B_SLASH --> ${t.precedence.toString(16)}`
        case '9':
            return `ESCAPED --> ${t.precedence.toString(16)}`
        case '10':
            return `WHITESPACE --> ${t.precedence.toString(16)}`
        case '11':
            return `QUOTE_END --> ${t.precedence.toString(16)}`
        case '12':
            return `TRI_QUOTE_END --> ${t.precedence.toString(16)}`
        case '13':
            return `D_QUOTE_END --> ${t.precedence.toString(16)}`
        case '14':
            return `TRI_D_QUOTE_END --> ${t.precedence.toString(16)}`
        case '15':
            return `EQUALS --> ${t.precedence.toString(16)}`
        case '16':
            return `PLUS --> ${t.precedence.toString(16)}`
        case '17':
            return `MINUS --> ${t.precedence.toString(16)}`
        case '18':
            return `INT --> ${t.precedence.toString(16)}`
        case '19':
            return `PREFIX_16 --> ${t.precedence.toString(16)}`
        case '20':
            return `PREFIX_8 --> ${t.precedence.toString(16)}`
        case '21':
            return `PREFIX_2 --> ${t.precedence.toString(16)}`
        case '22':
            return `UNDERSCORE --> ${t.precedence.toString(16)}`
        case '24':
            return `COMMA --> ${t.precedence.toString(16)}`
        case '25':
            return `LEFT_BRACE --> ${t.precedence.toString(16)}`
        case '26':
            return `RIGHT_BRACE --> ${t.precedence.toString(16)}`
        case '27':
            return `LEFT_BRACKET --> ${t.precedence.toString(16)}`
        case '28':
            return `DOT --> ${t.precedence.toString(16)}`
        case '29':
            return `RIGHT_BRACKET --> ${t.precedence.toString(16)}`
        case '30':
            return `DUAL_LEFT_BRACKET --> ${t.precedence.toString(16)}`
        case '31':
            return `DUAL_RIGHT_BRACKET --> ${t.precedence.toString(16)}`
        default:
            return "UNKNOWN";
    }
}