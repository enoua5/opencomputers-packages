/** type corrections for @opct */

import * as shell from "shell";
import * as filesystem from "filesystem";

/**
 * @noSelf
 * @noResolution
 */
declare module "shell" {
    /**
     * Utility methods intended for programs to parse their arguments.
     * Will return two tables, the first one containing any “normal” parameters, the second containing “options”.
     */
    function parse(
        ...args: string[]
    ): LuaMultiReturn<[string[], { [key: string]: string | true | null }]>;
}

/**
 * @noSelf
 * @noResolution
 */
declare module "filesystem" {
    /**
     * Concatenates ~~two~~ zero or more paths.
     */
    function concat(...args: string[]): string;
}
