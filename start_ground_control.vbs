Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
root = fso.GetParentFolderName(WScript.ScriptFullName)

shell.CurrentDirectory = root
shell.Run "pythonw tools\ground_control_launcher.py", 0, False
shell.Run """" & root & "\configurator.html""", 1, False
