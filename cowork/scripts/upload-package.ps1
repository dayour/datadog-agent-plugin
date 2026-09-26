Add-Type -AssemblyName UIAutomationClient, UIAutomationTypes

$proc = Get-Process msedge | Where-Object { $_.MainWindowTitle -like '*Cowork*' } | Select-Object -First 1
if (-not $proc) {
    Write-Host "Edge Cowork process not found"
    exit 1
}

$edge = [System.Windows.Automation.AutomationElement]::FromHandle($proc.MainWindowHandle)
$zip = "C:\Users\dayour\Downloads\jira_atlas\datadog\datadog-agent-plugin\cowork\appPackage\build\appPackage.dev.zip"

Write-Host "Looking for choose a file in Edge window..."
$cond = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::NameProperty, "choose a file")
$choose = $edge.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $cond)

if ($choose) {
    Write-Host "Found 'choose a file' element"
    
    # Bring Edge to foreground
    Add-Type -MemberDefinition @'
[DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
[DllImport("user32.dll")] public static extern bool SetCursorPos(int X, int Y);
[DllImport("user32.dll")] public static extern void mouse_event(int dwFlags, int dx, int dy, int dwData, int dwExtraInfo);
'@ -Name Win32Native -Namespace Win32Utils -ErrorAction SilentlyContinue

    [Win32Utils.Win32Native]::SetForegroundWindow($proc.MainWindowHandle)
    Start-Sleep -Milliseconds 300

    $rect = $choose.Current.BoundingRectangle
    Write-Host "Bounding rectangle: $rect"
    $x = [int]($rect.X + $rect.Width / 2)
    $y = [int]($rect.Y + $rect.Height / 2)
    Write-Host "Moving cursor to ($x, $y) and clicking..."
    
    [Win32Utils.Win32Native]::SetCursorPos($x, $y)
    Start-Sleep -Milliseconds 200
    [Win32Utils.Win32Native]::mouse_event(0x0002, 0, 0, 0, 0) # MOUSEEVENTF_LEFTDOWN
    Start-Sleep -Milliseconds 100
    [Win32Utils.Win32Native]::mouse_event(0x0004, 0, 0, 0, 0) # MOUSEEVENTF_LEFTUP
    
    Start-Sleep -Seconds 1

    $openCond = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::NameProperty, "Open")
    $openDlg = $null
    for ($i = 0; $i -lt 6; $i++) {
        $openDlg = [System.Windows.Automation.AutomationElement]::RootElement.FindFirst([System.Windows.Automation.TreeScope]::Children, $openCond)
        if ($openDlg) { break }
        Start-Sleep -Milliseconds 500
    }

    if ($openDlg) {
        Write-Host "Found Open dialog!"
        Start-Sleep -Milliseconds 300
        $editCond = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ControlTypeProperty, [System.Windows.Automation.ControlType]::Edit)
        $edit = $openDlg.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $editCond)
        if ($edit) {
            $valPat = $edit.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern) -as [System.Windows.Automation.ValuePattern]
            if ($valPat) {
                $valPat.SetValue($zip)
            } else {
                [System.Windows.Forms.Clipboard]::SetText($zip)
                [System.Windows.Forms.SendKeys]::SendWait("^v")
            }
            Start-Sleep -Milliseconds 400
            
            $btnCond = New-Object System.Windows.Automation.AndCondition(
                New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ControlTypeProperty, [System.Windows.Automation.ControlType]::Button),
                New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::NameProperty, "Open")
            )
            $btn = $openDlg.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $btnCond)
            if ($btn) {
                ($btn.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern) -as [System.Windows.Automation.InvokePattern]).Invoke()
                Write-Host "File submitted successfully to Open dialog!"
            } else {
                [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
                Write-Host "Sent ENTER to dialog"
            }
        }
    } else {
        Write-Host "Open dialog did not appear"
    }
} else {
    Write-Host "Could not find 'choose a file' in element tree, checking window elements..."
    $all = $edge.FindAll([System.Windows.Automation.TreeScope]::Descendants, [System.Windows.Automation.Condition]::TrueCondition)
    foreach ($e in $all) {
        if ($e.Current.Name -match "choose a file|Add a plugin|ZIP") {
            Write-Host "Element: $($e.Current.Name) [$($e.Current.ControlType.ProgrammaticName)]"
        }
    }
}
