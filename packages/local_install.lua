
local shell = require("shell")

local args = shell.parse(...)
local program = args[1]
if not string.gmatch(program, "^[%d%l%u%-_]$") then
    print("invalid package name")
    return
end
os.execute("rm -rf /tmp/" .. program)
os.execute("cp -r /packages/" .. program .. "/install /tmp/" .. program)
os.execute("install --from=/tmp --fromDir=/" .. program)
