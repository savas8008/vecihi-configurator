Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
toolsDir = fso.GetParentFolderName(WScript.ScriptFullName)
root = fso.GetParentFolderName(toolsDir)

shell.CurrentDirectory = root
shell.Run "pythonw tools\ground_control_launcher.py", 0, False
shell.Run """" & root & "\configurator.html""", 1, False
