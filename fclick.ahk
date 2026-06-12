#MaxThreadsPerHotkey 2

toggle := false

F1::
    toggle := !toggle
    if toggle
        SetTimer, PressF, -1
return

PressF:
    while toggle {
        Send {f down}
        Sleep 3000
        Send {f up}
        Sleep 1 000
    }
return
