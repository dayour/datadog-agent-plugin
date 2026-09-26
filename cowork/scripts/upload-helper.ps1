Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
Add-Type -AssemblyName System.Windows.Forms

$desktop = [System.Windows.Automation.AutomationElement]::RootElement
$cond = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::NameProperty, 'Cowork | Microsoft Copilot - Work 3 - Microsoft​ Edge')
$w = $desktop.FindFirst([System.Windows.Automation.TreeScope]::Children, $cond)

if (-not $w) {
    Write-Output "Cowork window not found by exact title, trying wildcard"
    $allWins = $desktop.FindAll([System.Windows.Automation.TreeScope]::Children, [System.Windows.Automation.Condition]::TrueCondition)
    foreach ($win in $allWins) {
        if ($win.Current.Name -like '*Cowork*Microsoft Copilot*') {
            $w = $win
            break
        }
    }
}

if ($w) {
    Write-Output "Found window: $($w.Current.Name)"
    $nameCond = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::NameProperty, 'choose a file')
    $chooseFile = $w.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $nameCond)
    if ($chooseFile) {
        Write-Output "Found 'choose a file' button/link"
        $pattern = $null
        if ($chooseFile.TryGetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern, [ref]$pattern)) {
            $pattern.Invoke()
            Write-Output "Invoked 'choose a file'"
        } else {
            Write-Output "No InvokePattern, trying bounding rect click"
            $rect = $chooseFile.Current.BoundingRectangle
            Write-Output "Rect: $rect"
        }
    } else {
        Write-Output "Control 'choose a file' not found. Listing matching elements:"
        $all = $w.FindAll([System.Windows.Automation.TreeScope]::Descendants, [System.Windows.Automation.Condition]::TrueCondition)
        foreach ($el in $all) {
            if ($el.Current.Name -match 'choose|file|folder|Add a plugin|Upload') {
                Write-Output "$($el.Current.ControlType.ProgrammaticName): $($el.Current.Name)"
            }
        }
    }
} else {
    Write-Output "Window not found"
}
