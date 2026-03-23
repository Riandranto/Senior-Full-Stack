@echo off
echo Fixing Java version in Capacitor Android files...

:: Fix capacitor-cordova-android-plugins/build.gradle
powershell -Command "(Get-Content android\capacitor-cordova-android-plugins\build.gradle) -replace 'VERSION_21', 'VERSION_17' | Set-Content android\capacitor-cordova-android-plugins\build.gradle"

:: Fix capacitor.build.gradle
powershell -Command "(Get-Content android\app\capacitor.build.gradle) -replace 'VERSION_21', 'VERSION_17' | Set-Content android\capacitor.build.gradle"

echo Java version fixed to 17.