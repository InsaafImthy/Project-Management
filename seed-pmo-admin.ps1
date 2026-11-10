<#
.SYNOPSIS
Creates or updates the PMO employee profile for an administrator and grants the
account the PMO Owners SharePoint role.

.DESCRIPTION
The PMO application derives full administrative capability from membership in
the PMO Owners group.  An active PMO_Employees item provides the matching
business identity.  It is intentionally the only list item this script seeds:
project, financial, time, and workflow lists require real referenced records
and must not contain synthetic administrator rows.

.EXAMPLE
./seed-pmo-admin.ps1 -ClientId 'YOUR-APPLICATION-CLIENT-ID' -WhatIf
./seed-pmo-admin.ps1 -ClientId 'YOUR-APPLICATION-CLIENT-ID'
#>

[CmdletBinding(SupportsShouldProcess = $true, ConfirmImpact = 'Medium')]
param(
    [Parameter()]
    [string]$SiteUrl = 'https://aufaitcloud.sharepoint.com/sites/ProjectManagementTool',

    [Parameter(Mandatory = $true)]
    [string]$ClientId,

    [Parameter()]
    [switch]$DeviceLogin,

    [Parameter()]
    [string]$DisplayName = 'Insaaf Imthiyas',

    [Parameter()]
    [ValidatePattern('^[^@\s]+@[^@\s]+\.[^@\s]+$')]
    [string]$Email = 'insaaf.imthiyas@aufaittechnologies.com',

    [Parameter()]
    [string]$EmployeeNumber = 'AUF-ADMIN-INSA'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

if (-not (Get-Module -ListAvailable -Name PnP.PowerShell)) {
    throw 'PnP.PowerShell is required. Install it with: Install-Module PnP.PowerShell -Scope CurrentUser'
}

$normalizedEmail = $Email.Trim().ToLowerInvariant()
$connectParameters = @{
    Url = $SiteUrl.TrimEnd('/')
    ClientId = $ClientId
    ReturnConnection = $true
}
if ($DeviceLogin) {
    $connectParameters.DeviceLogin = $true
} else {
    $connectParameters.Interactive = $true
}

$connection = Connect-PnPOnline @connectParameters
try {
    $web = Get-PnPWeb -Connection $connection
    Write-Host "Connected to: $($web.Title)" -ForegroundColor Green

    # Resolve the account before assigning the Person field or group membership.
    $siteUser = Get-PnPUser -Identity $normalizedEmail -Connection $connection -ErrorAction SilentlyContinue
    if (-not $siteUser) {
        $siteUser = New-PnPUser -LoginName $normalizedEmail -Connection $connection
    }
    if (-not $siteUser -or -not $siteUser.Id) {
        throw "Could not resolve SharePoint user '$normalizedEmail'. Confirm that the account exists in this Microsoft 365 tenant."
    }

    $ownersGroup = Get-PnPGroup -Identity 'PMO Owners' -Connection $connection -ErrorAction SilentlyContinue
    if (-not $ownersGroup) {
        throw "The required SharePoint group 'PMO Owners' does not exist. Create or map the approved role group before running this script."
    }

    $escapedEmail = $normalizedEmail.Replace("'", "''")
    $employee = Get-PnPListItem -List 'PMO_Employees' -Query "<View><Query><Where><Eq><FieldRef Name='Email'/><Value Type='Text'>$escapedEmail</Value></Eq></Where></Query><RowLimit>2</RowLimit></View>" -Connection $connection
    if (@($employee).Count -gt 1) {
        throw "More than one PMO_Employees record uses '$normalizedEmail'. Resolve the duplicate records before continuing."
    }

    $employeeValues = @{
        Title = $DisplayName
        EmployeeNumber = $EmployeeNumber
        EmployeeUser = $siteUser.Id
        Email = $normalizedEmail
        Department = 'PMO'
        JobTitle = 'PMO Administrator'
        EmploymentStatus = 'Active'
        StandardHoursPerDay = 8
        CapacityPercent = 100
        IsProjectManager = $true
        IsQA = $true
        IsApprover = $true
        IsResourceManager = $true
        IsActive = $true
    }

    if ($employee) {
        if ($PSCmdlet.ShouldProcess("PMO_Employees item $($employee.Id)", "Update active administrator profile for $normalizedEmail")) {
            Set-PnPListItem -List 'PMO_Employees' -Identity $employee.Id -Values $employeeValues -Connection $connection | Out-Null
        }
    } elseif ($PSCmdlet.ShouldProcess('PMO_Employees', "Create active administrator profile for $normalizedEmail")) {
        Add-PnPListItem -List 'PMO_Employees' -Values $employeeValues -Connection $connection | Out-Null
    }

    $isOwner = Get-PnPGroupMember -Group $ownersGroup -Connection $connection |
        Where-Object { $_.Id -eq $siteUser.Id }
    if (-not $isOwner) {
        if ($PSCmdlet.ShouldProcess('PMO Owners', "Add $normalizedEmail as PMO Owner")) {
            Add-PnPGroupMember -Group $ownersGroup -LoginName $normalizedEmail -Connection $connection
        }
    }

    if ($WhatIfPreference) {
        Write-Host 'Preview completed. No SharePoint changes were made.' -ForegroundColor Yellow
    } else {
        Write-Host "Admin access seeded for $normalizedEmail. Refresh or reopen the PMO application to renew its cached role context." -ForegroundColor Green
    }
}
finally {
    $connection = $null
}
