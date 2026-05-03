Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
root = fso.GetParentFolderName(WScript.ScriptFullName)

Set wmi = GetObject("winmgmts:\\.\root\cimv2")
Set processes = wmi.ExecQuery("SELECT * FROM Win32_Process WHERE Name='python.exe' OR Name='pythonw.exe'")

For Each proc In processes
    cmd = LCase("" & proc.CommandLine)
    If InStr(cmd, "ground_control_launcher.py") > 0 _
        Or InStr(cmd, "mavlink_ws_proxy.py") > 0 _
        Or InStr(cmd, "backpack_ws_proxy.py") > 0 Then
        proc.Terminate()
    End If
Next

WScript.Sleep 500
shell.CurrentDirectory = root
shell.Run "pythonw tools\ground_control_launcher.py", 0, False
shell.Run """" & root & "\configurator.html""", 1, False
