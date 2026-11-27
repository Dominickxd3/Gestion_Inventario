using System;
using System.IO;
using System.Net;
using System.Text;
using System.Threading;

namespace InventarioAgente
{
    static class Enviador
    {
        static string RutaPendiente
        {
            get { return Log.Carpeta == null ? null : Path.Combine(Log.Carpeta, "pendiente.json"); }
        }

        /// <summary>Envía el inventario. Devuelve la respuesta del servidor o un mensaje de error entendible.</summary>
        public static bool Enviar(Config cfg, string json, out string respuesta, out string error)
        {
            respuesta = null;
            error = null;

            // Habilita TLS 1.2 (necesario para HTTPS moderno en .NET Framework).
            ServicePointManager.SecurityProtocol |= (SecurityProtocolType)3072;

            byte[] cuerpo = Encoding.UTF8.GetBytes(json);
            const int intentos = 3;

            for (int i = 1; i <= intentos; i++)
            {
                try
                {
                    HttpWebRequest req = (HttpWebRequest)WebRequest.Create(cfg.Url);
                    req.Method = "POST";
                    req.ContentType = "application/json; charset=utf-8";
                    req.UserAgent = Program.Producto + "/" + Program.Version;
                    req.Timeout = cfg.TimeoutSegundos * 1000;
                    if (!string.IsNullOrEmpty(cfg.ApiKey)) req.Headers["X-Api-Key"] = cfg.ApiKey;
                    req.ContentLength = cuerpo.Length;
                    using (Stream s = req.GetRequestStream()) s.Write(cuerpo, 0, cuerpo.Length);

                    using (HttpWebResponse resp = (HttpWebResponse)req.GetResponse())
                    {
                        respuesta = Leer(resp);
                        Log.Escribir("Enviado a " + cfg.Url + " -> HTTP " + (int)resp.StatusCode + " " + respuesta);
                        return true;
                    }
                }
                catch (WebException ex)
                {
                    HttpWebResponse r = ex.Response as HttpWebResponse;
                    if (r != null)
                    {
                        int codigo = (int)r.StatusCode;
                        Log.Escribir("Intento " + i + ": HTTP " + codigo + " " + Leer(r));
                        if (codigo == 401 || codigo == 403)
                        {
                            error = "La clave de registro no es válida. Descarga nuevamente ScanGP desde la web.";
                            return false;
                        }
                        // Otros 4xx (datos inválidos) tampoco se arreglan reintentando.
                        if (codigo >= 400 && codigo < 500)
                        {
                            error = "El servidor rechazó la información (HTTP " + codigo + ").";
                            return false;
                        }
                        error = "El servidor respondió con un error (HTTP " + codigo + "). Intenta más tarde.";
                    }
                    else
                    {
                        Log.Escribir("Intento " + i + ": " + ex.Status + " - " + ex.Message);
                        error = "No se pudo conectar con el servidor (" + Servidor(cfg.Url) + "). "
                              + "Verifica que el equipo esté conectado a la red de la empresa.";
                    }
                }
                catch (Exception ex)
                {
                    Log.Escribir("Intento " + i + ": " + ex.Message);
                    error = "No se pudo enviar la información: " + ex.Message;
                }
                if (i < intentos) Thread.Sleep(i * 3000);
            }
            return false;
        }

        static string Servidor(string url)
        {
            try { return new Uri(url).Authority; } catch { return url; }
        }

        static string Leer(HttpWebResponse r)
        {
            try
            {
                using (StreamReader sr = new StreamReader(r.GetResponseStream(), Encoding.UTF8))
                {
                    string t = sr.ReadToEnd();
                    return t.Length > 300 ? t.Substring(0, 300) : t;
                }
            }
            catch { return ""; }
        }

        public static void GuardarPendiente(string json)
        {
            try
            {
                if (RutaPendiente == null) return;
                File.WriteAllText(RutaPendiente, json, new UTF8Encoding(false));
                Log.Escribir("No se pudo enviar. Inventario guardado en " + RutaPendiente);
            }
            catch (Exception ex) { Log.Escribir("No se pudo guardar pendiente: " + ex.Message); }
        }

        public static void BorrarPendiente()
        {
            try { if (RutaPendiente != null && File.Exists(RutaPendiente)) File.Delete(RutaPendiente); }
            catch { }
        }
    }
}
