@echo off
echo Fixing Java version from 21 to 17 in Capacitor Android files...

:: Fix capacitor-cordova-android-plugins/build.gradle
powershell -Command "(Get-Content android\capacitor-cordova-android-plugins\build.gradle) -replace 'VERSION_21', 'VERSION_17' | Set-Content android\capacitor-cordova-android-plugins\build.gradle"

:: Fix android/app/capacitor.build.gradle
powershell -Command "(Get-Content android\app\capacitor.build.gradle) -replace 'VERSION_21', 'VERSION_17' | Set-Content android\app\capacitor.build.gradle"

:: Fix node_modules/@capacitor/android/capacitor/build.gradle
powershell -Command "(Get-Content node_modules\@capacitor\android\capacitor\build.gradle) -replace 'VERSION_21', 'VERSION_17' | Set-Content node_modules\@capacitor\android\capacitor\build.gradle"

:: Fix node_modules/@capacitor/network/android/build.gradle
powershell -Command "(Get-Content node_modules\@capacitor\network\android\build.gradle) -replace 'VERSION_21', 'VERSION_17' | Set-Content node_modules\@capacitor\network\android\build.gradle"

:: Fix node_modules/@capacitor/preferences/android/build.gradle
powershell -Command "(Get-Content node_modules\@capacitor\preferences\android\build.gradle) -replace 'VERSION_21', 'VERSION_17' | Set-Content node_modules\@capacitor\preferences\android\build.gradle"

:: Fix node_modules/@capacitor/splash-screen/android/build.gradle
powershell -Command "(Get-Content node_modules\@capacitor\splash-screen\android\build.gradle) -replace 'VERSION_21', 'VERSION_17' | Set-Content node_modules\@capacitor\splash-screen\android\build.gradle"

echo Java version successfully fixed to 17.