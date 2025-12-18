; PDS Kiosk Client Installer Script for Inno Setup
;
; Build instructions:
; 1. Install Inno Setup from https://jrsoftware.org/isdl.php
; 2. Build the .NET project: dotnet publish KioskClient.Service -c Release -o publish
; 3. Run Playwright install: cd publish && pwsh playwright.ps1 install chromium
; 4. Compile this script with Inno Setup to create Setup.exe
; 5. Distribute Setup.exe
;
; Installation with parameters:
;   Setup.exe /VERYSILENT /ServerUrl=http://server:5001 /DeviceId=office-kiosk /DeviceToken=abc123
;
; Installation with GUI:
;   Setup.exe (will prompt for parameters)

#define MyAppName "PDS Kiosk Client"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "PDS"
#define MyAppURL "https://github.com/yourusername/pds"
#define MyAppExeName "KioskClient.Service.exe"
#define MyServiceName "PDSKioskClient"

[Setup]
AppId={{B8E9F1A2-3C4D-5E6F-7A8B-9C0D1E2F3A4B}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}
DefaultDirName={autopf}\PDS\KioskClient
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
OutputDir=.
OutputBaseFilename=PDSKioskClient-Setup
Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=admin
UninstallDisplayIcon={app}\{#MyAppExeName}
SetupIconFile=icon.ico
DisableWelcomePage=no
DisableDirPage=no
DisableFinishedPage=no
DisableReadyPage=no

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Types]
Name: "full"; Description: "Full installation"

[Components]
Name: "main"; Description: "Core files"; Types: full; Flags: fixed

[Files]
Source: "publish\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
; NOTE: Don't use "Flags: ignoreversion" on any shared system files

[Code]
var
  ServerUrlPage: TInputQueryWizardPage;
  DeviceIdPage: TInputQueryWizardPage;
  DeviceTokenPage: TInputQueryWizardPage;
  ServerUrl, DeviceId, DeviceToken: String;

function GetActualLoggedInUser(): String;
var
  ResultCode: Integer;
  TempFile: String;
  TempScript: String;
  UserInfo: AnsiString;
begin
  // Detect the actual logged-in user (not the elevated installer user)
  // We use PowerShell to find the owner of explorer.exe
  Result := '';
  TempFile := ExpandConstant('{tmp}\currentuser.txt');
  TempScript := ExpandConstant('{tmp}\getuser.ps1');

  // Create a PowerShell script file (easier than escaping quotes)
  SaveStringToFile(TempScript,
    '$p = Get-WmiObject Win32_Process -Filter "name=''explorer.exe''" | Select-Object -First 1; ' +
    'if ($p) { $o = $p.GetOwner(); "{0}\{1}" -f $o.Domain,$o.User | Out-File -FilePath "' + TempFile + '" -Encoding ASCII }',
    False);

  // Execute the script
  if Exec('powershell.exe',
    '-NoProfile -ExecutionPolicy Bypass -File "' + TempScript + '"',
    '', SW_HIDE, ewWaitUntilTerminated, ResultCode) then
  begin
    if FileExists(TempFile) then
    begin
      if LoadStringFromFile(TempFile, UserInfo) then
      begin
        Result := Trim(String(UserInfo));
      end;
      DeleteFile(TempFile);
    end;
    DeleteFile(TempScript);
  end;

  // Fallback to current user if detection fails
  if Result = '' then
    Result := GetUserNameString;
end;

function ReadExistingConfig(const Key: String): String;
var
  ConfigFile: String;
  ConfigContent: AnsiString;
  StartPos, EndPos: Integer;
  SearchKey: String;
begin
  Result := '';
  // Use {autopf} instead of {app} since {app} isn't available during InitializeWizard
  // {autopf} expands to Program Files directory which is determined by the system
  ConfigFile := ExpandConstant('{autopf}\PDS\KioskClient\appsettings.json');

  if FileExists(ConfigFile) then
  begin
    if LoadStringFromFile(ConfigFile, ConfigContent) then
    begin
      // Simple JSON parsing - look for "Key": "Value"
      SearchKey := '"' + Key + '": "';
      StartPos := Pos(SearchKey, ConfigContent);
      if StartPos > 0 then
      begin
        StartPos := StartPos + Length(SearchKey);
        EndPos := StartPos;
        while (EndPos <= Length(ConfigContent)) and (ConfigContent[EndPos] <> '"') do
          EndPos := EndPos + 1;
        Result := Copy(ConfigContent, StartPos, EndPos - StartPos);
      end;
    end;
  end;
end;

procedure InitializeWizard;
var
  ExistingServerUrl, ExistingDeviceId, ExistingDeviceToken: String;
begin
  // Check for command-line parameters first
  ServerUrl := ExpandConstant('{param:ServerUrl|}');
  DeviceId := ExpandConstant('{param:DeviceId|}');
  DeviceToken := ExpandConstant('{param:DeviceToken|}');

  // Try to read existing config if not provided via command line
  if ServerUrl = '' then
    ExistingServerUrl := ReadExistingConfig('ServerUrl')
  else
    ExistingServerUrl := ServerUrl;

  if DeviceId = '' then
    ExistingDeviceId := ReadExistingConfig('DeviceId')
  else
    ExistingDeviceId := DeviceId;

  if DeviceToken = '' then
    ExistingDeviceToken := ReadExistingConfig('DeviceToken')
  else
    ExistingDeviceToken := DeviceToken;

  // Only show pages if parameters not provided via command line
  if (ServerUrl = '') or (DeviceId = '') or (DeviceToken = '') then
  begin
    // Server URL page
    ServerUrlPage := CreateInputQueryPage(wpWelcome,
      'Server Configuration', 'Enter PDS Server URL',
      'Please enter the URL of your PDS server (e.g., http://192.168.0.57:5001)');
    ServerUrlPage.Add('Server URL:', False);
    if ExistingServerUrl <> '' then
      ServerUrlPage.Values[0] := ExistingServerUrl
    else
      ServerUrlPage.Values[0] := 'http://';

    // Device ID page
    DeviceIdPage := CreateInputQueryPage(ServerUrlPage.ID,
      'Device Configuration', 'Enter Device ID',
      'Please enter a unique identifier for this device (e.g., office-kiosk-1)');
    DeviceIdPage.Add('Device ID:', False);
    if ExistingDeviceId <> '' then
      DeviceIdPage.Values[0] := ExistingDeviceId
    else
      DeviceIdPage.Values[0] := GetComputerNameString;

    // Device Token page
    DeviceTokenPage := CreateInputQueryPage(DeviceIdPage.ID,
      'Device Authentication', 'Enter Device Token',
      'Please enter the device token from the PDS admin interface.' + #13#10 +
      'To obtain a token:' + #13#10 +
      '1. Log into the PDS admin UI' + #13#10 +
      '2. Go to Devices page' + #13#10 +
      '3. Create or select your device' + #13#10 +
      '4. Copy the Device Token');
    DeviceTokenPage.Add('Device Token:', False);
    if ExistingDeviceToken <> '' then
      DeviceTokenPage.Values[0] := ExistingDeviceToken;
  end
  else
  begin
    // If all parameters provided via command line or existing config, use them
    if ServerUrl = '' then ServerUrl := ExistingServerUrl;
    if DeviceId = '' then DeviceId := ExistingDeviceId;
    if DeviceToken = '' then DeviceToken := ExistingDeviceToken;
  end;
end;

function NextButtonClick(CurPageID: Integer): Boolean;
begin
  Result := True;

  // Validate Server URL page
  if CurPageID = ServerUrlPage.ID then  // Remove the ServerUrl = '' check
  begin
    ServerUrl := Trim(ServerUrlPage.Values[0]);
    if ServerUrl = '' then
    begin
      MsgBox('Please enter a server URL.', mbError, MB_OK);
      Result := False;
      Exit;
    end;
    if (Pos('http://', ServerUrl) <> 1) and (Pos('https://', ServerUrl) <> 1) then
    begin
      MsgBox('Server URL must start with http:// or https://', mbError, MB_OK);
      Result := False;
      Exit;
    end;
    // Check that URL has content after the protocol
    if (ServerUrl = 'http://') or (ServerUrl = 'https://') then
    begin
      MsgBox('Please enter a complete server URL (e.g., http://192.168.0.57:5001)', mbError, MB_OK);
      Result := False;
      Exit;
    end;
  end;

  // Validate Device ID page
  if CurPageID = DeviceIdPage.ID then  // Remove the DeviceId = '' check
  begin
    DeviceId := Trim(DeviceIdPage.Values[0]);
    if DeviceId = '' then
    begin
      MsgBox('Please enter a device ID.', mbError, MB_OK);
      Result := False;
      Exit;
    end;
  end;

  // Validate Device Token page
  if CurPageID = DeviceTokenPage.ID then  // Remove the DeviceToken = '' check
  begin
    DeviceToken := Trim(DeviceTokenPage.Values[0]);
    if DeviceToken = '' then
    begin
      MsgBox('Please enter a device token.', mbError, MB_OK);
      Result := False;
      Exit;
    end;
  end;
end;

procedure StopAndRemoveService;
var
  ResultCode: Integer;
begin
  // Stop service if running
  Exec('sc.exe', 'stop {#MyServiceName}', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  Sleep(2000);

  // Remove service if exists
  Exec('sc.exe', 'delete {#MyServiceName}', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  Sleep(2000);
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  ConfigFile: String;
  ConfigContent: String;
  ResultCode: Integer;
  ServiceExePath: String;
  ScCommand: String;
begin
  if CurStep = ssInstall then
  begin
    // Stop and remove existing service before installation
    StopAndRemoveService;
  end;

  if CurStep = ssPostInstall then
  begin
    // Get final values (from pages or command line)
    if ServerUrl = '' then
      ServerUrl := Trim(ServerUrlPage.Values[0]);
    if DeviceId = '' then
      DeviceId := Trim(DeviceIdPage.Values[0]);
    if DeviceToken = '' then
      DeviceToken := Trim(DeviceTokenPage.Values[0]);

    // Create appsettings.json
    ConfigFile := ExpandConstant('{app}\appsettings.json');
    ConfigContent := '{' + #13#10 +
      '  "Logging": {' + #13#10 +
      '    "LogLevel": {' + #13#10 +
      '      "Default": "Information",' + #13#10 +
      '      "Microsoft.Hosting.Lifetime": "Information"' + #13#10 +
      '    }' + #13#10 +
      '  },' + #13#10 +
      '  "Kiosk": {' + #13#10 +
      '    "ServerUrl": "' + ServerUrl + '",' + #13#10 +
      '    "DeviceId": "' + DeviceId + '",' + #13#10 +
      '    "DeviceToken": "' + DeviceToken + '",' + #13#10 +
      '    "HealthReportIntervalMs": 60000,' + #13#10 +
      '    "ScreenshotIntervalMs": 300000,' + #13#10 +
      '    "Headless": false,' + #13#10 +
      '    "KioskMode": false,' + #13#10 +
      '    "ViewportWidth": 1920,' + #13#10 +
      '    "ViewportHeight": 1080' + #13#10 +
      '  }' + #13#10 +
      '}';

    SaveStringToFile(ConfigFile, ConfigContent, False);

    // Set PLAYWRIGHT_BROWSERS_PATH environment variable so Playwright can find bundled browsers
    // This tells Playwright to look in the app's ms-playwright folder instead of user's AppData
    RegWriteStringValue(HKLM, 'SYSTEM\CurrentControlSet\Control\Session Manager\Environment',
      'PLAYWRIGHT_BROWSERS_PATH', ExpandConstant('{app}'));

    // Create browser profile directory with proper permissions
    // This prevents "Profile error occurred" when running as scheduled task
    ScCommand := ExpandConstant('{commonappdata}\PDS\browser-profile');
    if not DirExists(ScCommand) then
      CreateDir(ScCommand);

    // Grant full control to Users group using icacls
    Exec('icacls.exe', '"' + ScCommand + '" /grant Users:(OI)(CI)F /T', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);

    // Detect the actual logged-in user (not the elevated installer user)
    ScCommand := GetActualLoggedInUser();

    // Create Scheduled Task to auto-start on user login (instead of Windows Service)
    // This allows the browser UI to be visible since it runs in the user's interactive session
    ServiceExePath := ExpandConstant('{app}\{#MyAppExeName}');

    // Delete existing task if it exists
    Exec('schtasks.exe', '/Delete /TN "PDSKioskClient-AutoStart" /F', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);

    // Create scheduled task that runs at logon with highest privileges
    // Using the actual logged-in user, not the installer/elevated user
    ScCommand := '/Create /TN "PDSKioskClient-AutoStart" ' +
                 '/TR "\"' + ServiceExePath + '\"" ' +
                 '/SC ONLOGON ' +
                 '/RL HIGHEST ' +
                 '/F ' +
                 '/RU "' + ScCommand + '" ' +
                 '/IT';

    if Exec('schtasks.exe', ScCommand, '', SW_HIDE, ewWaitUntilTerminated, ResultCode) then
    begin
      if ResultCode = 0 then
      begin
        // Try to start the task immediately
        Exec('schtasks.exe', '/Run /TN "PDSKioskClient-AutoStart"', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
        MsgBox('Installation complete!' + #13#10 + #13#10 +
               'The Kiosk Client will start automatically when you log in.' + #13#10 + #13#10 +
               'The browser window should now be visible.', mbInformation, MB_OK);
      end
      else
        MsgBox('Failed to create scheduled task. Error code: ' + IntToStr(ResultCode), mbError, MB_OK);
    end
    else
    begin
      MsgBox('Failed to execute schtasks.exe', mbError, MB_OK);
    end;
  end;
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
var
  ResultCode: Integer;
begin
  if CurUninstallStep = usUninstall then
  begin
    // Stop and remove the Windows Service (for upgrades from old versions)
    StopAndRemoveService;

    // Remove scheduled task
    Exec('schtasks.exe', '/Delete /TN "PDSKioskClient-AutoStart" /F', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);

    // Remove PLAYWRIGHT_BROWSERS_PATH environment variable
    RegDeleteValue(HKLM, 'SYSTEM\CurrentControlSet\Control\Session Manager\Environment',
      'PLAYWRIGHT_BROWSERS_PATH');
  end;
end;

[UninstallDelete]
Type: filesandordirs; Name: "{app}"

[Icons]
Name: "{group}\Uninstall {#MyAppName}"; Filename: "{uninstallexe}"

; NOTE: Playwright browsers are pre-installed during the build process (BuildInstaller.ps1)
; No need to run playwright.ps1 during installation
