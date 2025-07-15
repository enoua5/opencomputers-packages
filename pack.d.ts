declare module "pack" {
    /** Fetch a list of packages available on the packages server */
    export function listAvailablePackages(): string[];
    /** Fetch file information for a package */
    export function getPackageFileInformation(
        pack: string
    ): { name: string; size: number }[]; /** Get information about a package */
    export function getPackageInformation(pack: string): {
        version: string;
        name: string;
        description: string;
        setup: string;
    };
    /** Fetch uninstall script */
    export function getUninstallScript(
        pack: string
    ): string; /** Fetch a chunk from a package directory */
    export function getPackageChunk(
        pack: string,
        file: string,
        page?: number
    ): string;
    /** Fetch a list of packages that have updates available */
    export function checkUpdates(
        packages_to_check: {
            pack: string;
            version: string;
        }[]
    ): {
        pack: string;
        version: string;
    }[];

    type PackfileData = {
        [pack: string]: {
            version: string;
        };
    };
    /** Read information about installed packages */
    export function readPackfile(): PackfileData;
    /** Set the package information listed in the packfile */
    export function setInstalledPackageInformation(
        pack: string,
        info: PackfileData[string]
    ): void;
    /** Remove the package form the installed package list */
    export function removePackageRecord(pack: string): void;
}
