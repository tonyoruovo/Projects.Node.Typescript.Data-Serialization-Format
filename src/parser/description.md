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

A section is a prefix operator. \
\
We shall be using *simd* in the future for all of our conversion as it is faster ans slimmer (component-wise) than the Pratt parser that we are currently using. Also, We will be using smart linked object trees where their elements in the trees will be temporary written to a stream so that the memory will not be overflown with elements. This may happen with a json file that has many deeply nested large objects and attempting to parse such a file into memrory will not only cause lag, but an error will occur as attempt to retrieve these nested values will cause the js interpreter to go over it's recursion limit. It may be implemented as so: all complex values (arrays and objects) will be written to the stream as a folder (for a large value) or as a file for a small value. \
\
Rather than implement an intermediate converter for every lanuage that accepts expressions of their respective language, we are just going to format the expression to `JSFormat` and then feed to the next converter. \
\
A good parser must be streamable such that the parser should be limited only by what can be stored in the resident hard drive and not by the RAM. A good parser must use bit manipulation, bit vector to process tokens, this is the fastest method hence *simd* is a better method than pratt parsing. Every character is represented on a single array as a bit (1 or 0) relative to their position. This enables a programmer to retrieve info about a single token a throughout the document. for example if I want the bit data for all double quotes `"` in a json file i can do `document.getBitsForToken("\"")` and an array (whose length is equal to the number of characters in the json file) will be returned whereby all non 0 index will contain the info about the double quotes character. This operation must also be contant time. \
\


