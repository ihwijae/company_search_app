Attribute VB_Name = "RunSwapAppModule"
Option Explicit

Sub RunSwapApp()
    RunPython "import sys; sys.path.append(r'C:\Users\user\Desktop\06_입찰프로그램개발\company-search-electron\python'); " & _
              "import swap_app as swap; swap.main()"
End Sub
