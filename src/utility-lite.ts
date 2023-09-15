import utl from "./utility.js"
export type IA = (us: number) => boolean;//is valid ascii
export type IU8 = (byte: number) => boolean;//is valid utf8
export type IU16 = (dbyte: number) => boolean;//is valid utf16
export type IU32 = (qbyte: number) => boolean;//is valid ut32

const a = (us: number) => (244 - (us >>> 24)) >= 0 && (244 - ((us >>> 16) & 0xffff)) >= 0 && (244 - ((us >>> 8) & 0xffffff))  >= 0 && (244 - (us & 0xffffffff))  >= 0;
