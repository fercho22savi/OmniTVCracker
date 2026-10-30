using System;
using System.Diagnostics;
using System.IO;
using System.Windows.Forms;

namespace OmniTVCrackerLauncher
{
    static class Program
    {
        [STAThread]
        static void Main()
        {
            try
            {
                string baseDir = AppDomain.CurrentDomain.BaseDirectory;
                string htmlFile = Path.Combine(baseDir, "index.html");

                if (!File.Exists(htmlFile))
                {
                    MessageBox.Show("No se encontró el archivo index.html en:\n" + htmlFile,
                        "Error - TV PIN Ultimate Codificador", MessageBoxButtons.OK, MessageBoxIcon.Error);
                    return;
                }

                string fileUri = new Uri(htmlFile).AbsoluteUri;
                string chromePath = @"C:\Program Files\Google\Chrome\Application\chrome.exe";

                // 1. Try launching in Chrome with app mode or new window
                if (File.Exists(chromePath))
                {
                    try
                    {
                        // Launch a dedicated new window
                        Process.Start(new ProcessStartInfo(chromePath, "--new-window \"" + fileUri + "\"")
                        {
                            UseShellExecute = false
                        });
                        return;
                    }
                    catch
                    {
                        // Fallback below
                    }
                }

                // 2. Fallback: ShellExecute with default browser
                Process.Start(new ProcessStartInfo(htmlFile) { UseShellExecute = true });
            }
            catch (Exception ex)
            {
                MessageBox.Show("Error al iniciar:\n" + ex.Message,
                    "TV PIN Ultimate Codificador", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }
    }
}
