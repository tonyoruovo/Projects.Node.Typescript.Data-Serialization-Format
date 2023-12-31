This is strictly for data serialisation hence, evaluation and compilation are not supported within languages.
- HOCON
- [Recfiles](https://www.gnu.org/software/recutils/manual/The-Rec-Format.html)
- CSON
- XML
- JSON5
- UBJSON
- BSON
- Smile
- CUE

# BUGS
There is a bug where if the file located at `data/csv/test2.csv` is converted to an ini and formatted with a string lexer, the last key named `description` in section `3` will be have the initial `'d'` replaced by a `'\'`. I need some more time to debug it.
### Here is the memory json after conversion to ini:
```json
'3': {
  Year: '1996',
  Make: 'Jeep',
  Model: 'Grand Cherokee',
  Description: 'MUST SELL!\r\nair, moon roof, loaded',
  Price: '4799.00'
}
```
### Here is the string format's data printed to `console.log`
```ini
[3]
Year = 1996
Make = Jeep
Model = Grand Cherokee
\escription = "MUST SELL!\
air, moon roof, loaded"
Price = 4799.00
```
However, I just found out that when I write the same code to a file, it comes out as intended. Like so:
```ini
[3]
Year = 1996
Make = Jeep
Model = Grand Cherokee
Description = "MUST SELL!\
\
air, moon roof, loaded"
Price = 4799.00
```
So the bug must come from `console.info` which is the implemtation of the logger underneath.
\
Formatters need Prettyfier and Minifier object. Params also need a warning system, for example, when a format to be produced from an expression cannot guarantee the same expression will be the result when the same format is parsed. \
\
We shall be using *simd* in the future for all of our conversion as it is faster ans slimmer (component-wise) than the Pratt parser that we are currently using. Also, We will be using smart linked object trees where their elements in the trees will be temporary written to a stream so that the memory will not be overflown with elements. This may happen with a json file that has many deeply nested large objects and attempting to parse such a file into memrory will not only cause lag, but an error will occur as attempt to retrieve these nested values will cause the js interpreter to go over it's recursion limit. It may be implemented as so: all complex values (arrays and objects) will be written to the stream as a folder (for a large value) or as a file for a small value. \
\
Rather than implement an intermediate converter for every lanuage that accepts expressions of their respective language, we are just going to format the expression to `JSFormat` and then feed to the next converter. \
\
A good parser must be streamable such that the parser should be limited only by what can be stored in the resident hard drive and not by the RAM. A good parser must use bit manipulation, bit vector to process tokens, this is the fastest method hence *simd* is a better method than pratt parsing. Every character is represented on a single array as a bit (1 or 0) relative to their position. This enables a programmer to retrieve info about a single token a throughout the document. for example if I want the bit data for all double quotes `"` in a json file i can do `document.getBitsForToken("\"")` and an array (whose length is equal to the number of characters in the json file) will be returned whereby all non 0 index will contain the info about the double quotes character. This operation must also be contant time. \
\
When looking to create a parser for a set of file extensions, go on to Github.com and search using `path:/(^|\/)*\.extension$/` where *extension* is the file extension for the data you want create a parser for. This will give you a braod idea of how these file can be parsed as well as sample files to parse. \
\
Always set the tab and newline character in the syntax. Relying on the standard \t and \n will prevent many files from different os to be parsed. In the same spirit, also walways set all operators
\
Text expression should contain the src and shoulbe declared thus:
```ts
class Text {
  constructor(formatted: string, src?: string){
    //assign all parameters here ...
  }
}
```
This is because when a text has escaped/special values, the formatter will not know exactly how to print the text to a file hence may end up escaping all values that are intended to be literal (such as a literally escaped new line with obvious extra lines such as using a `\` before a new line) or printing a literal meant to be escaped (such as unicode escapes).
