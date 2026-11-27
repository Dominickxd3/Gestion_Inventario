// ScanGP - registrador de equipos para Windows.
// Recolecta el hardware/software del equipo vía WMI y lo envía en JSON a la API (NestJS).
//
// Modos:
//   ScanGP.exe                     -> muestra una ventana con el progreso (usuario final)
//   ScanGP.exe --silencioso        -> sin ventana (despliegue por GPO / Intune / tarea programada)
//   ScanGP.exe --solo-local --salida inv.json   -> no envía, solo guarda el JSON
//   ScanGP.exe --url http://servidor:3000/api/inventario --apikey CLAVE
//
// Configuración (de menor a mayor prioridad): valores por defecto -> configuración incrustada
// por la web al descargar -> agente.ini junto al .exe -> argumentos.

using System;
using System.Collections.Generic;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Web.Script.Serialization;
using System.Windows.Forms;

namespace InventarioAgente
{
    /// <summary>Resultado de una ejecución, usado por la ventana y por el código de salida.</summary>
    class Resultado
    {
        public int Codigo;               // 0 enviado, 1 no enviado, 2 error inesperado
        public string Mensaje;
        public bool? EquipoNuevo;
        public Dictionary<string, object> Equipo;
    }

    static class Program
    {
        public const string Producto = "ScanGP";
        public const string Version = "1.1.0";

        [DllImport("user32.dll")]
        static extern bool SetProcessDPIAware();

        [STAThread]
        static int Main(string[] args)
        {
            Log.Iniciar();
            Log.Escribir("=== " + Producto + " v" + Version + " iniciado ===");

            Config cfg;
            try { cfg = Config.Cargar(args); }
            catch (Exception ex) { Log.Escribir("ERROR de configuración: " + ex); return 2; }

            if (cfg.Silencioso || cfg.SoloLocal)
                return Ejecutar(cfg, null).Codigo;

            try { SetProcessDPIAware(); } catch { }
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            VentanaRegistro v = new VentanaRegistro(cfg);
            Application.Run(v);
            return v.Codigo;
        }

        /// <summary>Recolecta y envía. Se usa igual en modo ventana (en un hilo aparte) y silencioso.</summary>
        public static Resultado Ejecutar(Config cfg, Action<int> progreso)
        {
            Resultado r = new Resultado();
            try
            {
                Dictionary<string, object> datos = Recolector.Recolectar(progreso);
                datos["agenteVersion"] = Version;
                datos["fechaRecoleccion"] = DateTime.UtcNow.ToString("o");
                r.Equipo = datos["equipo"] as Dictionary<string, object>;

                string json = Json.Serializar(datos);
                Log.Escribir("Inventario recolectado (" + json.Length + " bytes).");

                if (!string.IsNullOrEmpty(cfg.Salida))
                {
                    File.WriteAllText(cfg.Salida, json, new UTF8Encoding(false));
                    Log.Escribir("JSON guardado en " + cfg.Salida);
                }

                if (cfg.SoloLocal)
                {
                    r.Codigo = 0;
                    r.Mensaje = "Inventario guardado localmente (no se envió).";
                    return r;
                }

                if (progreso != null) progreso(Recolector.Pasos.Length - 1);

                string respuesta, error;
                if (Enviador.Enviar(cfg, json, out respuesta, out error))
                {
                    Enviador.BorrarPendiente();
                    r.Codigo = 0;
                    r.Mensaje = "Equipo registrado correctamente.";
                    try
                    {
                        Dictionary<string, object> resp = new JavaScriptSerializer().Deserialize<Dictionary<string, object>>(respuesta);
                        if (resp != null && resp.ContainsKey("nuevo")) r.EquipoNuevo = Convert.ToBoolean(resp["nuevo"]);
                    }
                    catch { }
                    return r;
                }

                // Copia local para revisión; la próxima ejecución vuelve a recolectar y reintenta.
                Enviador.GuardarPendiente(json);
                r.Codigo = 1;
                r.Mensaje = error;
                return r;
            }
            catch (Exception ex)
            {
                Log.Escribir("ERROR fatal: " + ex);
                r.Codigo = 2;
                r.Mensaje = "Ocurrió un error inesperado: " + ex.Message;
                return r;
            }
        }
    }
}
