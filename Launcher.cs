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
                string baseDir  = AppDomain.CurrentDomain.BaseDirectory;
                string htmlFile = Path.Combine(baseDir, "index.html");
                string serverPy = Path.Combine(baseDir, "server.py");

                if (!File.Exists(htmlFile))
                {
                    MessageBox.Show("No se encontró index.html en:\n" + htmlFile,
                        "Error - OmniTVCracker", MessageBoxButtons.OK, MessageBoxIcon.Error);
                    return;
                }

                // ── 1. Iniciar backend Python (server.py) si existe ──────────
                if (File.Exists(serverPy) && IsPythonAvailable())
                {
                    try
                    {
                        var pyProc = new ProcessStartInfo("python", "\"" + serverPy + "\"")
                        {
                            UseShellExecute    = false,
                            WorkingDirectory   = baseDir,
                            CreateNoWindow     = true,
                            WindowStyle        = ProcessWindowStyle.Minimized,
                        };
                        Process.Start(pyProc);
                        // Breve pausa para que el servidor levante
                        System.Threading.Thread.Sleep(1600);
                    }
                    catch
                    {
                        // Si no se puede arrancar el backend, continuar solo con simulación
                    }
                }

                // ── 2. Abrir interfaz en Chrome ──────────────────────────────
                string fileUri    = new Uri(htmlFile).AbsoluteUri;
                string chromePath = @"C:\Program Files\Google\Chrome\Application\chrome.exe";

                if (File.Exists(chromePath))
                {
                    try
                    {
                        Process.Start(new ProcessStartInfo(chromePath,
                            "--new-window \"" + fileUri + "\"")
                        {
                            UseShellExecute = false
                        });
                        return;
                    }
                    catch { /* Fallback abajo */ }
                }

                // ── 3. Fallback: navegador predeterminado ────────────────────
                Process.Start(new ProcessStartInfo(htmlFile) { UseShellExecute = true });
            }
            catch (Exception ex)
            {
                MessageBox.Show("Error al iniciar:\n" + ex.Message,
                    "OmniTVCracker", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }

        /// <summary>
        /// Comprueba si Python está disponible en el PATH.
        /// </summary>
        static bool IsPythonAvailable()
        {
            try
            {
                var p = Process.Start(new ProcessStartInfo("python", "--version")
                {
                    UseShellExecute        = false,
                    RedirectStandardOutput = true,
                    RedirectStandardError  = true,
                    CreateNoWindow         = true
                });
                p.WaitForExit(3000);
                return p.ExitCode == 0;
            }
            catch
            {
                return false;
            }
        }
    }
}
