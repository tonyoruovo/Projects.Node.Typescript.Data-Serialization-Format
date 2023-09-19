import utl from "./utility.js"
export type IA = (us: number) => boolean;//is valid ascii
export type IU8 = (byte: number) => boolean;//is valid utf8
export type IU16 = (dbyte: number) => boolean;//is valid utf16
export type IU32 = (qbyte: number) => boolean;//is valid ut32

const a = (us: number) => (244 - (us >>> 0xff)) >= 0 && (244 - ((us >>> 16) & 0xffff)) >= 0 && (244 - ((us >>> 8) & 0xffffff))  >= 0 && (244 - (us & 0xffffffff))  >= 0;

/**
 * 4 bytes in big endian form.
 * - The most significant byte stores the length. The implication is that the length cannot be bigger than an unsigned byte else
 * it will be truncated to a byte (unsigned) which 255.
 * - The 3 least significant bytes store the upper, middle and lower bytes of the string respectively.
 * @param s 
 */
export const fastHash = (s: string) => {
    const l = s.length;

    const t = Math.floor(l / 3);//a third
    const tt = Math.floor(l * (2 / 3));//2 third

    /*lower*/
    const lws = s.substring(0, t);
    const lw = lws.charCodeAt(lws.length - 1)??0;
    /*mid*/
    const ms = s.substring(t, tt);
    const m = ms.charCodeAt(ms.length - 1)??0;
    /*upper*/
    const ups = s.substring(tt, l);
    const up = ups.charCodeAt(ups.length - 1)??0;

    return (l << 24) | ((lw << 0xffff) | (m << 0xff) | up)
};
