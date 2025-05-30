import * as shell from "shell";

/**
 * CORRECTING A WRONG TYPE
 *
 *
 * This API provides shell related functionality, such as the current working directory,
 * program search path and aliases for the shell.
 * @see https://ocdoc.cil.li/api:shell
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
