This is strictly for data serialisation hence, evaluation and compilation are not supported within languages.
- HOCON
- Recfiles
- CSON
- XML
- JSON5
- UBJSON
- BSON
- Smile
- CUE

A section is a prefix operator. 

We shall be using *simd* in the future for all of our conversion as it is faster ans slimmer (component-wise) than the Pratt parser that we are currently using. Also, We will be using smart linked object trees where their elements in the trees will be temporary written to a stream so that the memory will not be overflown with elements. This may happen with a json file that has many deeply nested large objects and attempting to parse such a file into memrory will not only cause lag, but an error will occur as attempt to retrieve these nested values will cause the js interpreter to go over it's recursion limit. It may be implemented as so: all complex values (arrays and objects) will be written to the stream as a folder (for a large value) or as a file for a small value.
