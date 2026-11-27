using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Management;
using System.Text;
using System.Web.Script.Serialization;

namespace InventarioAgente
{
    /// <summary>
    /// Configuración. Prioridad: por defecto -> incrustada en el .exe (la pone la web al descargar)
    /// -> agente.ini junto al .exe -> argumentos de línea de comandos.
    /// </summary>
    class Config
    {
        // Marcas del bloque (ASCII) que la API agrega al final del .exe descargado.
        // Dentro del .exe estas cadenas se guardan en UTF-16, así que no generan coincidencias falsas.
        const string MarcaInicio = "##SCANGP-CONFIG##";
        const string MarcaFin = "##SCANGP-FIN##";

        public string Url = "http://localhost:3000/api/inventario";
        public string ApiKey = "";
        public int TimeoutSegundos = 30;
        public string Salida;
        public bool SoloLocal;
        public bool Silencioso;
        public string Origen = "valores por defecto";

        public static Config Cargar(string[] args)
        {
            Config c = new Config();

            string incrustada = LeerIncrustada();
            if (incrustada != null)
            {
                c.Aplicar(incrustada.Split('\n'));
                c.Origen = "configuración de descarga";
            }

            string ini = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "agente.ini");
            if (File.Exists(ini))
            {
                c.Aplicar(File.ReadAllLines(ini));
                c.Origen = "agente.ini";
            }

            for (int i = 0; i < args.Length; i++)
            {
                string a = args[i].ToLowerInvariant().TrimStart('-', '/');
                string sig = i + 1 < args.Length ? args[i + 1] : null;
                if (a == "url" && sig != null) { c.Url = sig; c.Origen = "argumentos"; i++; }
                else if (a == "apikey" && sig != null) { c.ApiKey = sig; i++; }
                else if (a == "salida" && sig != null) { c.Salida = Path.GetFullPath(sig); i++; }
                else if (a == "solo-local") c.SoloLocal = true;
                else if (a == "silencioso" || a == "silent" || a == "s" || a == "quiet") c.Silencioso = true;
            }
            if (c.TimeoutSegundos <= 0) c.TimeoutSegundos = 30;
            Log.Escribir("Servidor: " + c.Url + " (" + c.Origen + ")");
            return c;
        }

        void Aplicar(string[] lineas)
        {
            foreach (string linea in lineas)
            {
                string l = linea.Trim();
                if (l.Length == 0 || l.StartsWith("#") || l.StartsWith(";")) continue;
                int eq = l.IndexOf('=');
                if (eq <= 0) continue;
                string k = l.Substring(0, eq).Trim().ToLowerInvariant();
                string v = l.Substring(eq + 1).Trim();
                if (k == "url") Url = v;
                else if (k == "apikey") ApiKey = v;
                else if (k == "timeout") int.TryParse(v, out TimeoutSegundos);
            }
        }

        /// <summary>Lee el bloque de configuración agregado al final del propio .exe (si existe).</summary>
        static string LeerIncrustada()
        {
            try
            {
                string exe = System.Reflection.Assembly.GetExecutingAssembly().Location;
                using (FileStream fs = File.OpenRead(exe))
                {
                    int largo = (int)Math.Min(8192, fs.Length);
                    fs.Seek(-largo, SeekOrigin.End);
                    byte[] buf = new byte[largo];
                    int leidos = 0;
                    while (leidos < largo)
                    {
                        int n = fs.Read(buf, leidos, largo - leidos);
                        if (n <= 0) break;
                        leidos += n;
                    }
                    string cola = Encoding.ASCII.GetString(buf, 0, leidos);
                    int i = cola.LastIndexOf(MarcaInicio, StringComparison.Ordinal);
                    if (i < 0) return null;
                    int ini = i + MarcaInicio.Length;
                    int fin = cola.IndexOf(MarcaFin, ini, StringComparison.Ordinal);
                    if (fin < 0) return null;
                    return Encoding.UTF8.GetString(Convert.FromBase64String(cola.Substring(ini, fin - ini).Trim()));
                }
            }
            catch (Exception ex)
            {
                Log.Escribir("No se pudo leer la configuración incrustada: " + ex.Message);
                return null;
            }
        }
    }

    /// <summary>Log en %ProgramData%\ScanGP\scangp.log (o %TEMP% si no hay permiso).</summary>
    static class Log
    {
        static string ruta;
        public static string Carpeta;

        public static void Iniciar()
        {
            string[] candidatas = {
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "ScanGP"),
                Path.Combine(Path.GetTempPath(), "ScanGP")
            };
            foreach (string dir in candidatas)
            {
                try
                {
                    Directory.CreateDirectory(dir);
                    string p = Path.Combine(dir, "scangp.log");
                    // Rotación simple: si pasa de 1 MB se reinicia.
                    if (File.Exists(p) && new FileInfo(p).Length > 1024 * 1024) File.Delete(p);
                    File.AppendAllText(p, "");
                    ruta = p;
                    Carpeta = dir;
                    return;
                }
                catch { }
            }
        }

        public static void Escribir(string msg)
        {
            if (ruta == null) return;
            try
            {
                File.AppendAllText(ruta, DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss") + "  " + msg + Environment.NewLine, Encoding.UTF8);
            }
            catch { }
        }
    }

    static class Json
    {
        public static string Serializar(object o)
        {
            JavaScriptSerializer s = new JavaScriptSerializer();
            s.MaxJsonLength = int.MaxValue;
            s.RecursionLimit = 100;
            return s.Serialize(o);
        }
    }

    /// <summary>Ayudantes para consultar WMI de forma tolerante a fallos.</summary>
    static class Wmi
    {
        public static List<ManagementBaseObject> Consultar(string query)
        {
            return Consultar(@"root\cimv2", query);
        }

        public static List<ManagementBaseObject> Consultar(string scope, string query)
        {
            List<ManagementBaseObject> lista = new List<ManagementBaseObject>();
            try
            {
                ManagementObjectSearcher s = new ManagementObjectSearcher(scope, query);
                foreach (ManagementBaseObject o in s.Get()) lista.Add(o);
            }
            catch (Exception ex)
            {
                Log.Escribir("WMI no disponible [" + scope + "] " + query + " -> " + ex.Message);
            }
            return lista;
        }

        public static ManagementBaseObject Primero(string query)
        {
            List<ManagementBaseObject> l = Consultar(query);
            return l.Count > 0 ? l[0] : null;
        }

        public static object Valor(ManagementBaseObject o, string prop)
        {
            if (o == null) return null;
            try { return o[prop]; } catch { return null; }
        }

        public static string Str(ManagementBaseObject o, string prop)
        {
            object v = Valor(o, prop);
            if (v == null) return null;
            string s = v.ToString().Trim();
            return s.Length == 0 ? null : s;
        }

        public static long? Long(ManagementBaseObject o, string prop)
        {
            object v = Valor(o, prop);
            if (v == null) return null;
            try { return Convert.ToInt64(v, CultureInfo.InvariantCulture); } catch { return null; }
        }

        public static int? Int(ManagementBaseObject o, string prop)
        {
            long? l = Long(o, prop);
            if (!l.HasValue) return null;
            return (int)l.Value;
        }

        public static bool? Bool(ManagementBaseObject o, string prop)
        {
            object v = Valor(o, prop);
            if (v == null) return null;
            try { return Convert.ToBoolean(v); } catch { return null; }
        }

        /// <summary>Convierte fechas CIM (yyyymmddHHMMSS.mmmmmmsUUU) a ISO 8601.</summary>
        public static string Fecha(ManagementBaseObject o, string prop)
        {
            string s = Str(o, prop);
            if (s == null) return null;
            try { return ManagementDateTimeConverter.ToDateTime(s).ToUniversalTime().ToString("o"); }
            catch { return null; }
        }

        /// <summary>Convierte arreglos de ushort/byte (p. ej. WmiMonitorID) a texto.</summary>
        public static string TextoDeArreglo(ManagementBaseObject o, string prop)
        {
            object v = Valor(o, prop);
            Array arr = v as Array;
            if (arr == null) return null;
            StringBuilder sb = new StringBuilder();
            foreach (object c in arr)
            {
                int n = Convert.ToInt32(c);
                if (n == 0) break;
                sb.Append((char)n);
            }
            string r = sb.ToString().Trim();
            return r.Length == 0 ? null : r;
        }
    }

    static class Texto
    {
        static readonly string[] Basura = {
            "to be filled by o.e.m.", "to be filled by oem", "default string", "system serial number",
            "system product name", "system manufacturer", "not applicable", "not specified", "none",
            "invalid", "o.e.m.", "oem", "0", "00000000", "0000000000", "123456789", "chassis serial number",
            "base board serial number", "n/a", "unknown", "serial", "system version", "sku",
            "default", "x.x", "type1productconfigid", "to be filled by o.e.m"
        };

        /// <summary>Descarta los valores de relleno que ponen los fabricantes en la BIOS.</summary>
        public static string Limpiar(string s)
        {
            if (s == null) return null;
            s = s.Trim().TrimEnd('.'); // los NVMe suelen terminar en "."
            if (s.Length == 0) return null;
            string l = s.ToLowerInvariant();
            foreach (string b in Basura) if (l == b) return null;
            if (s.Trim('0', 'F', 'f', '-', ' ').Length == 0) return null; // 0000-..., FFFF-...
            return s;
        }

        public static bool Contiene(string texto, params string[] patrones)
        {
            if (texto == null) return false;
            string t = texto.ToLowerInvariant();
            foreach (string p in patrones) if (t.Contains(p)) return true;
            return false;
        }
    }
}
