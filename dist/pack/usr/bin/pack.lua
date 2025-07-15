local ____exports = {}
local filesystem = require("filesystem")
local shell = require("shell")
local pack = require("pack")
local uuid = require("uuid")
local args, options = shell.parse(...)
local function printHelp()
    print("Usage: pack [...OPTIONS] COMMAND [...ARGS]")
    print("-h, --help: print this help message")
    print("")
    print("Commands:")
    print("list")
    print("    List all available packages")
    print("installed")
    print("    Display information about installed packages")
    print("info PACKAGE")
    print("    Display information about PACKAGE")
    print("files PACKAGE")
    print("    Display a file listing for PACKAGE")
    print("show-uninstall PACKAGE")
    print("    Display the uninstall script for PACKAGE")
    print("uninstall PACKAGE")
    print("    Uninstall PACKAGE from the system")
    print("install PACKAGE")
    print("    install or update PACKAGE")
    print("check")
    print("    List available updates")
    print("upgrade")
    print("    Update all installed packages")
end
local function getAvailableUpdates(installed)
    local packs = {}
    for pack, info in pairs(installed) do
        packs[#packs + 1] = {pack = pack, version = info.version}
    end
    return pack.checkUpdates(packs)
end
local function install(p)
    print(("Downloading " .. p) .. "...")
    local files = pack.getPackageFileInformation(p)
    local file_id = string.gsub(
        uuid.next(),
        "-",
        ""
    )
    local tmp = "/tmp/" .. file_id
    for ____, file in ipairs(files) do
        local filename = filesystem.concat(tmp, file.name)
        local pages = math.ceil(file.size / 1024)
        filesystem.makeDirectory(filesystem.path(filename))
        local f = io.open(filename, "w")
        if f == nil then
            error("Failed to create " .. file.name, 0)
        end
        do
            local page = 0
            while page < pages do
                local chunk = pack.getPackageChunk(p, file.name, page)
                f:write(chunk)
                print(("    " .. tostring(math.ceil((page + 1) / pages * 1000) / 10)) .. "%")
                page = page + 1
            end
        end
        f:close()
    end
    print(("Installing " .. p) .. "...")
    shell.execute(("install --from=/tmp --fromDir=/" .. file_id) .. " --noreboot")
    print("Cleaning up...")
    filesystem.remove(tmp)
end
local function main()
    if #args < 1 or options.h or options.help then
        printHelp()
        return
    end
    local command = args[1]
    if command == "list" then
        if #args ~= 1 then
            error("`pack list` takes no arguments", 0)
        end
        local packages = pack.listAvailablePackages()
        for ____, p in ipairs(packages) do
            print(p)
        end
        return
    end
    if command == "installed" then
        if #args ~= 1 then
            error("`pack installed` takes no arguments", 0)
        end
        local installed = pack.readPackfile()
        for pack, info in pairs(installed) do
            print((tostring(pack) .. " version ") .. info.version)
        end
        return
    end
    if command == "info" then
        if #args ~= 2 then
            error("`pack info` requires exactly 1 argument", 0)
        end
        local info = pack.getPackageInformation(args[2])
        print(info.name)
        print("Version " .. info.version)
        print(info.description)
        print("Setup instructions: " .. info.setup)
        return
    end
    if command == "files" then
        if #args ~= 2 then
            error("`pack files` requires exactly 1 argument", 0)
        end
        local file_info = pack.getPackageFileInformation(args[2])
        for ____, f in ipairs(file_info) do
            print(((f.name .. " (") .. tostring(f.size)) .. " bytes)")
        end
        return
    end
    if command == "show-uninstall" then
        if #args ~= 2 then
            error("`pack show-uninstall` requires exactly 1 argument", 0)
        end
        local uninstall_script = pack.getUninstallScript(args[2])
        print(uninstall_script)
        return
    end
    if command == "uninstall" then
        if #args ~= 2 then
            error("`pack uninstall` requires exactly 1 argument", 0)
        end
        print("Fetching uninstall script...")
        local uninstall_script = pack.getUninstallScript(args[2])
        print("Preparing uninstall...")
        local file_id = string.gsub(
            uuid.next(),
            "-",
            ""
        )
        local filename = ("/tmp/" .. file_id) .. ".lua"
        local uninstall_file = io.open(filename, "w")
        if uninstall_file == nil then
            error("failed to create uninstall script", 0)
        end
        uninstall_file:write(uninstall_script)
        uninstall_file:close()
        print("Running uninstall...")
        shell.execute(filename)
        print("Cleaning up...")
        pack.removePackageRecord(args[2])
        print("Done!")
        return
    end
    if command == "install" then
        if #args ~= 2 then
            error("`pack install` requires exactly 1 argument", 0)
        end
        install(args[2])
        return
    end
    if command == "check" then
        if #args ~= 1 then
            error("`pack check` takes no arguments", 0)
        end
        local installed = pack.readPackfile()
        local updates = getAvailableUpdates(installed)
        for ____, update in ipairs(updates) do
            print((((update.pack .. " ") .. (installed[update.pack] or ({version = "??"})).version) .. " => ") .. update.version)
        end
        return
    end
    if command == "upgrade" then
        if #args ~= 1 then
            error("`pack upgrade` takes no arguments", 0)
        end
        local installed = pack.readPackfile()
        local updates = getAvailableUpdates(installed)
        for ____, info in ipairs(updates) do
            install(info.pack)
        end
        return
    end
    error(("Unrecognized command '" .. command) .. "'", 0)
end
main()
return ____exports
