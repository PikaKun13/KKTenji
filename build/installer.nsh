; KKTenji NSIS custom: per-user (HKCU) right-click "Open with KKTenji" entries.
; NOTE: this file must be saved as UTF-8 WITH BOM (Japanese strings).
; After editing with tools that strip BOM, re-add it (see docs/STATUS.md).

!macro writeOpenWith KEY
  WriteRegStr HKCU "Software\Classes\${KEY}\shell\KKTenji" "" "KKTenji で開く"
  WriteRegStr HKCU "Software\Classes\${KEY}\shell\KKTenji" "Icon" "$INSTDIR\${APP_EXECUTABLE_FILENAME}"
  WriteRegStr HKCU "Software\Classes\${KEY}\shell\KKTenji\command" "" '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" "%1"'
!macroend

!macro removeOpenWith KEY
  DeleteRegKey HKCU "Software\Classes\${KEY}\shell\KKTenji"
!macroend

!macro customInstall
  ; .json への全域登録は行わない（deck と無関係な JSON にまでメニューが出るため）
  !insertmacro writeOpenWith "SystemFileAssociations\.pptx"
  !insertmacro writeOpenWith "SystemFileAssociations\.md"
  ; フォルダ右クリック
  WriteRegStr HKCU "Software\Classes\Directory\shell\KKTenji" "" "KKTenji で開く"
  WriteRegStr HKCU "Software\Classes\Directory\shell\KKTenji" "Icon" "$INSTDIR\${APP_EXECUTABLE_FILENAME}"
  WriteRegStr HKCU "Software\Classes\Directory\shell\KKTenji\command" "" '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" "%V"'
!macroend

!macro customUnInstall
  !insertmacro removeOpenWith "SystemFileAssociations\.pptx"
  !insertmacro removeOpenWith "SystemFileAssociations\.md"
  ; 旧版が登録した .json 分も掃除する
  !insertmacro removeOpenWith "SystemFileAssociations\.json"
  DeleteRegKey HKCU "Software\Classes\Directory\shell\KKTenji"
!macroend
