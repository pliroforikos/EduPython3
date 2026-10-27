; Προσθήκες στον installer (το electron-builder φορτώνει αυτόματα το build/installer.nsh).
;
; Λειτουργία «Τάξη»:
;  - κανόνας στο Τείχος προστασίας των Windows, ώστε ο υπολογιστής του καθηγητή να δέχεται τους μαθητές
;    (TCP 47800, UDP 47801) χωρίς ερώτηση· μόνο σε δίκτυα τομέα / ιδιωτικά.
;  - ο φάκελος %ProgramData%\Python2-EPAL με δικαιώματα «μόνο ανάγνωση» για τους χρήστες.
;  - /CLASSROOM=<διαδρομή classroom.json>: αντιγραφή του αρχείου εμπιστοσύνης στο %ProgramData%\Python2-EPAL,
;    π.χ. σιωπηλή εγκατάσταση στους υπολογιστές των μαθητών:
;      Python2-EPAL-x.y.z-setup.exe /S /CLASSROOM=\\server\share\classroom.json

!include "FileFunc.nsh"
!include "LogicLib.nsh"

!define EPAL_FW_RULE "Python2-EPAL Classroom"

!macro customInstall
  nsExec::Exec 'netsh advfirewall firewall delete rule name="${EPAL_FW_RULE}"'
  Pop $0
  nsExec::Exec 'netsh advfirewall firewall add rule name="${EPAL_FW_RULE}" dir=in action=allow program="$INSTDIR\${APP_EXECUTABLE_FILENAME}" enable=yes profile=domain,private'
  Pop $0

  ; Ο φάκελος του classroom.json: μόνο ανάγνωση για τους χρήστες. Αλλιώς (δικαιώματα του ProgramData) ένας μαθητής
  ; θα μπορούσε να δημιουργήσει δικό του classroom.json σε υπολογιστή που δεν έχει ακόμα.
  ; SID αντί για ονόματα ομάδων, που αλλάζουν με τη γλώσσα των Windows: Administrators, SYSTEM, Users.
  SetShellVarContext all
  CreateDirectory "$APPDATA\Python2-EPAL"
  ; πρώτα ιδιοκτήτες οι Administrators (αν τον φάκελο τον είχε φτιάξει χρήστης, θα μπορούσε να αλλάξει τα δικαιώματα)
  nsExec::Exec 'icacls "$APPDATA\Python2-EPAL" /setowner *S-1-5-32-544 /T /C'
  Pop $0
  nsExec::Exec 'icacls "$APPDATA\Python2-EPAL" /inheritance:r /grant:r *S-1-5-32-544:(OI)(CI)F *S-1-5-18:(OI)(CI)F *S-1-5-32-545:(OI)(CI)RX /T /C'
  Pop $0

  ${GetParameters} $R0
  ClearErrors
  ${GetOptions} $R0 "/CLASSROOM=" $R1
  ${IfNot} ${Errors}
  ${AndIf} $R1 != ""
    ${If} ${FileExists} "$R1"
      CopyFiles /SILENT "$R1" "$APPDATA\Python2-EPAL\classroom.json"
    ${EndIf}
  ${EndIf}
!macroend

!macro customUnInstall
  nsExec::Exec 'netsh advfirewall firewall delete rule name="${EPAL_FW_RULE}"'
  Pop $0
!macroend
