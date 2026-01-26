using System;
using System.Collections.Generic;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.Json;
using System.Threading;

public class KakaoSendHelper
{
    public class Payload
    {
        public List<Item> items { get; set; } = new List<Item>();
    }

    public class Item
    {
        public string room { get; set; } = "";
        public string message { get; set; } = "";
        public string chatType { get; set; } = "chat";
    }

    public class Result
    {
        public string room { get; set; } = "";
        public bool success { get; set; }
        public string error { get; set; } = "";
    }

    public class Output
    {
        public bool success { get; set; }
        public List<Result> results { get; set; } = new List<Result>();
    }

    public static class Win32
    {
        [DllImport("user32.dll", SetLastError = true)]
        public static extern IntPtr FindWindow(string lpClassName, string lpWindowName);

        [DllImport("user32.dll", SetLastError = true)]
        public static extern IntPtr FindWindowEx(IntPtr hwndParent, IntPtr hwndChildAfter, string lpszClass, string lpszWindow);

        [DllImport("user32.dll", SetLastError = true)]
        public static extern int GetClassName(IntPtr hWnd, StringBuilder lpClassName, int nMaxCount);

        [DllImport("user32.dll", SetLastError = true)]
        public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

        [DllImport("user32.dll", SetLastError = true)]
        public static extern int GetWindowTextLength(IntPtr hWnd);

        [DllImport("user32.dll")]
        public static extern bool SetForegroundWindow(IntPtr hWnd);

        [DllImport("user32.dll")]
        public static extern IntPtr SetFocus(IntPtr hWnd);

        [DllImport("user32.dll", CharSet = CharSet.Auto)]
        public static extern IntPtr SendMessage(IntPtr hWnd, int Msg, IntPtr wParam, string lParam);

        [DllImport("user32.dll")]
        public static extern bool PostMessage(IntPtr hWnd, int Msg, IntPtr wParam, IntPtr lParam);

        [DllImport("user32.dll")]
        public static extern void keybd_event(byte bVk, byte bScan, int dwFlags, int dwExtraInfo);
    }

    private const int WM_SETTEXT = 0x000C;
    private const int WM_KEYDOWN = 0x0100;
    private const int VK_RETURN = 0x0D;
    private const int VK_CONTROL = 0x11;
    private const int VK_LEFT = 0x25;
    private const int VK_RIGHT = 0x27;
    private const int KEYEVENTF_KEYUP = 0x0002;

    public static int Main(string[] args)
    {
        if (args.Length < 2)
        {
            return 2;
        }

        string inputPath = args[0];
        string outputPath = args[1];

        try
        {
            var payload = JsonSerializer.Deserialize<Payload>(File.ReadAllText(inputPath, Encoding.UTF8));
            if (payload == null || payload.items == null || payload.items.Count == 0)
            {
                WriteOutput(outputPath, new Output { success = false });
                return 3;
            }

            var output = new Output { success = true };
            foreach (var item in payload.items)
            {
                var result = new Result { room = item.room ?? "" };
                try
                {
                    if (string.IsNullOrWhiteSpace(item.room) || string.IsNullOrWhiteSpace(item.message))
                    {
                        throw new Exception("room or message missing");
                    }

                    int chatType = ParseChatType(item.chatType);
                    ActiveChat(item.room, chatType);
                    Thread.Sleep(200);

                    IntPtr chatHwnd = FindChatWindow(item.room);
                    if (chatHwnd == IntPtr.Zero)
                    {
                        throw new Exception("채팅방 창을 찾지 못했습니다.");
                    }

                    IntPtr richEdit = Win32.FindWindowEx(chatHwnd, IntPtr.Zero, "RichEdit50W", null);
                    if (richEdit == IntPtr.Zero)
                    {
                        richEdit = Win32.FindWindowEx(chatHwnd, IntPtr.Zero, "Edit", null);
                    }
                    if (richEdit == IntPtr.Zero)
                    {
                        throw new Exception("메시지 입력창을 찾지 못했습니다.");
                    }

                    Win32.SetForegroundWindow(chatHwnd);
                    Thread.Sleep(100);
                    Win32.SetFocus(richEdit);
                    Thread.Sleep(100);

                    SetText(richEdit, "");
                    Thread.Sleep(80);
                    SetText(richEdit, item.message);
                    Thread.Sleep(80);
                    SetEnter(chatHwnd);

                    result.success = true;
                }
                catch (Exception ex)
                {
                    result.success = false;
                    result.error = ex.Message;
                }
                output.results.Add(result);
                Thread.Sleep(250);
            }

            WriteOutput(outputPath, output);
            return 0;
        }
        catch
        {
            return 1;
        }
    }

    private static int ParseChatType(string chatType)
    {
        if (string.Equals(chatType, "friend", StringComparison.OrdinalIgnoreCase)) return 0;
        if (string.Equals(chatType, "open", StringComparison.OrdinalIgnoreCase)) return 2;
        return 1;
    }

    private static void WriteOutput(string path, Output output)
    {
        var options = new JsonSerializerOptions { WriteIndented = false };
        File.WriteAllText(path, JsonSerializer.Serialize(output, options), Encoding.UTF8);
    }

    private static IntPtr FindHwndEVA()
    {
        IntPtr hwnd = Win32.FindWindowEx(IntPtr.Zero, IntPtr.Zero, null, null);
        while (hwnd != IntPtr.Zero)
        {
            string className = GetClassName(hwnd);
            if (className.Contains("EVA_Window_Dblclk"))
            {
                string title = GetWindowText(hwnd);
                if (title.Contains("카카오톡") || title.Contains("KakaoTalk"))
                {
                    return hwnd;
                }
            }
            hwnd = Win32.FindWindowEx(IntPtr.Zero, hwnd, null, null);
        }
        return IntPtr.Zero;
    }

    private static void ActiveChat(string target, int chatType)
    {
        if (chatType == 0) ActiveUserChat(target);
        else if (chatType == 2) ActiveGroupChat(target, true);
        else ActiveGroupChat(target, false);
    }

    private static void ActiveUserChat(string target)
    {
        IntPtr hwndMain = FindHwndEVA();
        if (hwndMain == IntPtr.Zero) throw new Exception("카카오톡 창을 찾을 수 없습니다.");

        IntPtr hwndOnline = FindChildWindowByName(hwndMain, "OnlineMainView");
        IntPtr hwndList = FindChildWindowByName(hwndOnline, "ContactListView");
        IntPtr hwndEdit = Win32.FindWindowEx(hwndList, IntPtr.Zero, "Edit", null);
        if (hwndEdit == IntPtr.Zero) throw new Exception("채팅 검색창(Edit)을 찾을 수 없습니다.");

        SetText(hwndEdit, target);
        Thread.Sleep(500);
        SetEnter(hwndEdit);
        Thread.Sleep(200);
        SetText(hwndEdit, "");
    }

    private static void ActiveGroupChat(string target, bool isOpenChat)
    {
        IntPtr hwndMain = FindHwndEVA();
        if (hwndMain == IntPtr.Zero) throw new Exception("카카오톡 창을 찾을 수 없습니다.");

        IntPtr hwndOnline = FindChildWindowByName(hwndMain, "OnlineMainView");
        IntPtr hwndList = FindChildWindowByName(hwndOnline, "ChatRoomListView");
        IntPtr hwndEdit = Win32.FindWindowEx(hwndList, IntPtr.Zero, "Edit", null);
        if (hwndEdit == IntPtr.Zero) throw new Exception("채팅 검색창(Edit)을 찾을 수 없습니다.");

        if (isOpenChat) SendCtrlRight(hwndEdit); else SendCtrlLeft(hwndEdit);
        SetText(hwndEdit, target);
        Thread.Sleep(500);
        SetEnter(hwndEdit);
        Thread.Sleep(200);
        SetText(hwndEdit, "");
    }

    private static IntPtr FindChatWindow(string title)
    {
        IntPtr hwnd = Win32.FindWindow(null, title);
        if (hwnd != IntPtr.Zero) return hwnd;

        DateTime start = DateTime.Now;
        while ((DateTime.Now - start).TotalSeconds < 5)
        {
            hwnd = Win32.FindWindow(null, title);
            if (hwnd != IntPtr.Zero) return hwnd;
            Thread.Sleep(100);
        }
        return IntPtr.Zero;
    }

    private static void SetText(IntPtr hwnd, string text)
    {
        Win32.SendMessage(hwnd, WM_SETTEXT, IntPtr.Zero, text ?? "");
    }

    private static void SetEnter(IntPtr hwnd)
    {
        Win32.PostMessage(hwnd, WM_KEYDOWN, (IntPtr)VK_RETURN, IntPtr.Zero);
    }

    private static void SendCtrlRight(IntPtr hwnd)
    {
        Win32.SetForegroundWindow(hwnd);
        Thread.Sleep(300);
        Win32.keybd_event((byte)VK_CONTROL, 0, 0, 0);
        Win32.keybd_event((byte)VK_RIGHT, 0, 0, 0);
        Win32.keybd_event((byte)VK_RIGHT, 0, KEYEVENTF_KEYUP, 0);
        Win32.keybd_event((byte)VK_CONTROL, 0, KEYEVENTF_KEYUP, 0);
    }

    private static void SendCtrlLeft(IntPtr hwnd)
    {
        Win32.SetForegroundWindow(hwnd);
        Thread.Sleep(300);
        Win32.keybd_event((byte)VK_CONTROL, 0, 0, 0);
        Win32.keybd_event((byte)VK_LEFT, 0, 0, 0);
        Win32.keybd_event((byte)VK_LEFT, 0, KEYEVENTF_KEYUP, 0);
        Win32.keybd_event((byte)VK_CONTROL, 0, KEYEVENTF_KEYUP, 0);
    }

    private static IntPtr FindChildWindowByName(IntPtr parent, string name)
    {
        IntPtr child = Win32.FindWindowEx(parent, IntPtr.Zero, null, null);
        while (child != IntPtr.Zero)
        {
            string title = GetWindowText(child);
            if (!string.IsNullOrEmpty(title) && title.Contains(name))
            {
                return child;
            }
            child = Win32.FindWindowEx(parent, child, null, null);
        }
        return IntPtr.Zero;
    }

    private static string GetWindowText(IntPtr hwnd)
    {
        int length = Win32.GetWindowTextLength(hwnd);
        if (length <= 0) return string.Empty;
        var sb = new StringBuilder(length + 1);
        Win32.GetWindowText(hwnd, sb, sb.Capacity);
        return sb.ToString();
    }

    private static string GetClassName(IntPtr hwnd)
    {
        var sb = new StringBuilder(128);
        Win32.GetClassName(hwnd, sb, sb.Capacity);
        return sb.ToString();
    }
}
