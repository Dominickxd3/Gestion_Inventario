using System;
using System.Collections.Generic;
using System.Management;
using Microsoft.Win32;

namespace InventarioAgente
{
    /// <summary>Recolecta el inventario del equipo. Cada sección falla de forma aislada.</summary>
    static class Recolector
    {
        // Tipos de chasis SMBIOS (Win32_SystemEnclosure.ChassisTypes)
        static readonly int[] ChasisLaptop = { 8, 9, 10, 14, 31, 32 };          // Portable, Laptop, Notebook, Sub-Notebook, Convertible, Detachable
        static readonly int[] ChasisEscritorio = { 3, 4, 5, 6, 7, 15, 16, 24, 35, 36 }; // Desktop, Low Profile, Pizza Box, Mini Tower, Tower, Space-saving, Lunch Box, Sealed-case, Mini PC, Stick PC
        static readonly int[] ChasisAllInOne = { 13 };
        static readonly int[] ChasisTablet = { 30 };
        static readonly int[] ChasisServidor = { 17, 23, 28 };

        /// <summary>Pasos que se muestran en la ventana. El último ("Enviando") lo maneja Program.</summary>
        public static readonly string[] Pasos = {
            "Identificando el equipo",
            "Procesador y memoria",
            "Almacenamiento",
            "Video y monitores",
            "Red y seguridad",
            "Programas instalados",
            "Enviando al servidor"
        };

        /// <param name="alIniciarPaso">Se invoca con el índice de Pasos antes de cada grupo (puede ser null).</param>
        public static Dictionary<string, object> Recolectar(Action<int> alIniciarPaso)
        {
            Dictionary<string, object> d = new Dictionary<string, object>();
            List<string> advertencias = new List<string>();
            Action<int> paso = alIniciarPaso ?? delegate { };

            paso(0);
            Seccion(d, advertencias, "equipo", Equipo);
            Seccion(d, advertencias, "sistemaOperativo", SistemaOperativo);
            Seccion(d, advertencias, "placaBase", PlacaBase);
            Seccion(d, advertencias, "bios", Bios);
            paso(1);
            Seccion(d, advertencias, "procesadores", Procesadores);
            Seccion(d, advertencias, "memoria", Memoria);
            paso(2);
            Seccion(d, advertencias, "discos", Discos);
            Seccion(d, advertencias, "volumenes", Volumenes);
            paso(3);
            Seccion(d, advertencias, "graficos", Graficos);
            Seccion(d, advertencias, "monitores", Monitores);
            paso(4);
            Seccion(d, advertencias, "red", Red);
            Seccion(d, advertencias, "bateria", Bateria);
            Seccion(d, advertencias, "antivirus", Antivirus);
            paso(5);
            Seccion(d, advertencias, "software", Software);

            d["advertencias"] = advertencias;
            return d;
        }

        static void Seccion(Dictionary<string, object> d, List<string> adv, string nombre, Func<object> f)
        {
            try { d[nombre] = f(); }
            catch (Exception ex)
            {
                d[nombre] = null;
                adv.Add(nombre + ": " + ex.Message);
                Log.Escribir("Sección '" + nombre + "' falló: " + ex);
            }
        }

        // ------------------------------------------------------------------ EQUIPO
        static object Equipo()
        {
            ManagementBaseObject cs = Wmi.Primero("SELECT * FROM Win32_ComputerSystem");
            ManagementBaseObject prod = Wmi.Primero("SELECT * FROM Win32_ComputerSystemProduct");
            ManagementBaseObject enc = Wmi.Primero("SELECT * FROM Win32_SystemEnclosure");
            ManagementBaseObject bios = Wmi.Primero("SELECT * FROM Win32_BIOS");

            string fabricante = Texto.Limpiar(Wmi.Str(cs, "Manufacturer"));
            string modelo = Texto.Limpiar(Wmi.Str(cs, "Model"));
            // Lenovo guarda el nombre comercial (p. ej. "ThinkPad T14 Gen 2") en ComputerSystemProduct.Version
            string modeloComercial = Texto.Limpiar(Wmi.Str(prod, "Version"));
            if (Texto.Contiene(fabricante, "lenovo") && modeloComercial != null)
            {
                string codigo = modelo;
                modelo = modeloComercial;
                modeloComercial = codigo;
            }
            else if (modeloComercial != null && Texto.Contiene(modeloComercial, "not available", "none"))
            {
                modeloComercial = null;
            }

            // PC ensamblada (clon): la BIOS no trae modelo, se usa la placa base para identificarla.
            bool ensamblada = false;
            ManagementBaseObject placa = Wmi.Primero("SELECT Manufacturer, Product, SerialNumber FROM Win32_BaseBoard");
            if (modelo == null)
            {
                string placaModelo = Texto.Limpiar(Wmi.Str(placa, "Product"));
                if (placaModelo != null)
                {
                    modelo = "PC ensamblada (" + placaModelo + ")";
                    ensamblada = true;
                }
            }
            if (fabricante == null) fabricante = Texto.Limpiar(Wmi.Str(placa, "Manufacturer"));

            string serie = Texto.Limpiar(Wmi.Str(bios, "SerialNumber"))
                ?? Texto.Limpiar(Wmi.Str(enc, "SerialNumber"))
                ?? Texto.Limpiar(Wmi.Str(placa, "SerialNumber"));
            string uuid = Texto.Limpiar(Wmi.Str(prod, "UUID"));

            List<int> chasis = new List<int>();
            Array arr = Wmi.Valor(enc, "ChassisTypes") as Array;
            if (arr != null) foreach (object o in arr) chasis.Add(Convert.ToInt32(o));

            bool tieneBateria = Wmi.Consultar("SELECT DeviceID FROM Win32_Battery").Count > 0;
            int? pcSystemType = Wmi.Int(cs, "PCSystemType"); // 2 = Mobile

            string metodo;
            string tipo = DetectarTipo(fabricante, modelo, chasis, tieneBateria, pcSystemType, out metodo);

            string usuario = UsuarioActual(cs);

            Dictionary<string, object> r = new Dictionary<string, object>();
            r["nombreEquipo"] = Environment.MachineName;
            r["usuario"] = usuario;
            r["usuarioEjecucion"] = Environment.UserDomainName + "\\" + Environment.UserName;
            r["dominio"] = Wmi.Str(cs, "Domain");
            r["enDominio"] = Wmi.Bool(cs, "PartOfDomain");
            r["fabricante"] = fabricante;
            r["modelo"] = modelo;
            r["modeloCodigo"] = modeloComercial;
            r["familia"] = Texto.Limpiar(Wmi.Str(cs, "SystemFamily"));
            r["sku"] = Texto.Limpiar(Wmi.Str(cs, "SystemSKUNumber"));
            r["numeroSerie"] = serie;
            r["uuid"] = uuid;
            r["etiquetaActivo"] = Texto.Limpiar(Wmi.Str(enc, "SMBIOSAssetTag"));
            r["tipo"] = tipo;
            r["tipoDeteccion"] = metodo;
            r["chasisCodigos"] = chasis;
            r["tieneBateria"] = tieneBateria;
            r["ensamblada"] = ensamblada;
            return r;
        }

        /// <summary>
        /// Determina LAPTOP / ESCRITORIO / ALL_IN_ONE / TABLET / SERVIDOR / VIRTUAL / DESCONOCIDO.
        /// Orden: máquina virtual -> modelo conocido AIO -> tipo de chasis -> batería.
        /// </summary>
        static string DetectarTipo(string fabricante, string modelo, List<int> chasis, bool bateria, int? pcType, out string metodo)
        {
            string fm = (fabricante ?? "") + " " + (modelo ?? "");

            if (Texto.Contiene(fm, "vmware", "virtualbox", "virtual machine", "kvm", "qemu", "hyper-v", "xen", "parallels", "bochs"))
            { metodo = "modelo (virtual)"; return "VIRTUAL"; }

            if (Texto.Contiene(modelo, "all-in-one", "all in one", "aio", "eliteone", "proone", "imac"))
            { metodo = "modelo"; return "ALL_IN_ONE"; }

            foreach (int c in chasis)
            {
                if (Array.IndexOf(ChasisAllInOne, c) >= 0) { metodo = "chasis " + c; return "ALL_IN_ONE"; }
            }
            foreach (int c in chasis)
            {
                if (Array.IndexOf(ChasisLaptop, c) >= 0) { metodo = "chasis " + c; return "LAPTOP"; }
                if (Array.IndexOf(ChasisTablet, c) >= 0) { metodo = "chasis " + c; return "TABLET"; }
                if (Array.IndexOf(ChasisServidor, c) >= 0) { metodo = "chasis " + c; return "SERVIDOR"; }
                if (Array.IndexOf(ChasisEscritorio, c) >= 0)
                {
                    // Algunos portátiles baratos reportan chasis "Desktop": la batería los delata.
                    if (bateria) { metodo = "chasis " + c + " + batería"; return "LAPTOP"; }
                    metodo = "chasis " + c; return "ESCRITORIO";
                }
            }

            if (bateria || pcType == 2) { metodo = "batería"; return "LAPTOP"; }
            if (pcType == 1) { metodo = "PCSystemType"; return "ESCRITORIO"; }

            metodo = "sin datos";
            return "DESCONOCIDO";
        }

        /// <summary>Usuario con sesión interactiva (funciona aunque el agente corra como SYSTEM).</summary>
        static string UsuarioActual(ManagementBaseObject cs)
        {
            string u = Wmi.Str(cs, "UserName");
            if (u != null) return u;

            // En sesiones RDP Win32_ComputerSystem.UserName viene vacío: se busca el dueño de explorer.exe
            foreach (ManagementBaseObject p in Wmi.Consultar("SELECT Handle FROM Win32_Process WHERE Name='explorer.exe'"))
            {
                try
                {
                    ManagementObject mo = p as ManagementObject;
                    if (mo == null) continue;
                    object[] salida = new object[2];
                    object res = mo.InvokeMethod("GetOwner", salida);
                    if (Convert.ToInt32(res) == 0 && salida[0] != null)
                        return (salida[1] != null ? salida[1] + "\\" : "") + salida[0];
                }
                catch { }
            }

            string actual = Environment.UserName;
            if (actual.EndsWith("$")) return null; // cuenta de equipo (SYSTEM) sin nadie logueado
            return Environment.UserDomainName + "\\" + actual;
        }

        // ------------------------------------------------------------------ SISTEMA OPERATIVO
        static object SistemaOperativo()
        {
            ManagementBaseObject os = Wmi.Primero("SELECT * FROM Win32_OperatingSystem");
            Dictionary<string, object> r = new Dictionary<string, object>();
            r["nombre"] = Wmi.Str(os, "Caption");
            r["version"] = Wmi.Str(os, "Version");
            r["build"] = Wmi.Str(os, "BuildNumber");
            r["arquitectura"] = Wmi.Str(os, "OSArchitecture");
            string[] idiomas = Wmi.Valor(os, "MUILanguages") as string[];
            r["idioma"] = idiomas != null && idiomas.Length > 0 ? string.Join(", ", idiomas) : Wmi.Str(os, "Locale");
            r["fechaInstalacion"] = Wmi.Fecha(os, "InstallDate");
            r["ultimoArranque"] = Wmi.Fecha(os, "LastBootUpTime");
            r["idProducto"] = Wmi.Str(os, "SerialNumber");

            try
            {
                using (RegistryKey k = RegistryKey.OpenBaseKey(RegistryHive.LocalMachine, RegistryView.Registry64)
                    .OpenSubKey(@"SOFTWARE\Microsoft\Windows NT\CurrentVersion"))
                {
                    if (k != null)
                    {
                        r["versionComercial"] = k.GetValue("DisplayVersion") as string ?? k.GetValue("ReleaseId") as string; // 23H2, 24H2...
                        object ubr = k.GetValue("UBR");
                        if (ubr != null) r["buildCompleto"] = r["build"] + "." + ubr;
                    }
                }
            }
            catch { }
            return r;
        }

        // ------------------------------------------------------------------ CPU
        static object Procesadores()
        {
            List<object> l = new List<object>();
            foreach (ManagementBaseObject p in Wmi.Consultar("SELECT * FROM Win32_Processor"))
            {
                Dictionary<string, object> r = new Dictionary<string, object>();
                r["nombre"] = Wmi.Str(p, "Name");
                r["fabricante"] = Wmi.Str(p, "Manufacturer");
                r["nucleos"] = Wmi.Int(p, "NumberOfCores");
                r["hilos"] = Wmi.Int(p, "NumberOfLogicalProcessors");
                r["velocidadMaxMHz"] = Wmi.Int(p, "MaxClockSpeed");
                r["socket"] = Wmi.Str(p, "SocketDesignation");
                r["cacheL2KB"] = Wmi.Int(p, "L2CacheSize");
                r["cacheL3KB"] = Wmi.Int(p, "L3CacheSize");
                r["idProcesador"] = Wmi.Str(p, "ProcessorId");
                r["virtualizacionHabilitada"] = Wmi.Bool(p, "VirtualizationFirmwareEnabled");
                l.Add(r);
            }
            return l;
        }

        // ------------------------------------------------------------------ RAM
        static object Memoria()
        {
            ManagementBaseObject cs = Wmi.Primero("SELECT TotalPhysicalMemory FROM Win32_ComputerSystem");
            List<object> modulos = new List<object>();
            long instalada = 0;

            foreach (ManagementBaseObject m in Wmi.Consultar("SELECT * FROM Win32_PhysicalMemory"))
            {
                long cap = Wmi.Long(m, "Capacity") ?? 0;
                instalada += cap;
                Dictionary<string, object> r = new Dictionary<string, object>();
                r["banco"] = Wmi.Str(m, "DeviceLocator");
                r["capacidadBytes"] = cap;
                r["velocidadMHz"] = Wmi.Int(m, "ConfiguredClockSpeed") ?? Wmi.Int(m, "Speed");
                r["velocidadMaxMHz"] = Wmi.Int(m, "Speed");
                r["fabricante"] = Texto.Limpiar(Wmi.Str(m, "Manufacturer"));
                r["numeroParte"] = Texto.Limpiar(Wmi.Str(m, "PartNumber"));
                r["numeroSerie"] = Texto.Limpiar(Wmi.Str(m, "SerialNumber"));
                r["tipo"] = TipoMemoria(Wmi.Int(m, "SMBIOSMemoryType"));
                r["formato"] = FormatoMemoria(Wmi.Int(m, "FormFactor"));
                modulos.Add(r);
            }

            int ranuras = 0;
            foreach (ManagementBaseObject a in Wmi.Consultar("SELECT MemoryDevices FROM Win32_PhysicalMemoryArray"))
                ranuras += Wmi.Int(a, "MemoryDevices") ?? 0;

            Dictionary<string, object> res = new Dictionary<string, object>();
            res["instaladaBytes"] = instalada;
            res["utilizableBytes"] = Wmi.Long(cs, "TotalPhysicalMemory");
            res["ranurasTotales"] = ranuras > 0 ? (object)ranuras : null;
            res["ranurasUsadas"] = modulos.Count;
            res["modulos"] = modulos;
            return res;
        }

        static string TipoMemoria(int? t)
        {
            if (!t.HasValue) return null;
            switch (t.Value)
            {
                case 20: return "DDR";
                case 21: return "DDR2";
                case 24: return "DDR3";
                case 26: return "DDR4";
                case 27: return "LPDDR";
                case 28: return "LPDDR2";
                case 29: return "LPDDR3";
                case 30: return "LPDDR4";
                case 34: return "DDR5";
                case 35: return "LPDDR5";
                default: return null;
            }
        }

        static string FormatoMemoria(int? f)
        {
            if (f == 8) return "DIMM";
            if (f == 12) return "SODIMM";
            if (f == 0 || f == null) return null;
            return "Otro (" + f + ")";
        }

        // ------------------------------------------------------------------ DISCOS
        static object Discos()
        {
            List<object> l = new List<object>();
            // MSFT_PhysicalDisk (Windows 8+) distingue SSD/HDD/NVMe, Win32_DiskDrive no.
            foreach (ManagementBaseObject d in Wmi.Consultar(@"root\Microsoft\Windows\Storage", "SELECT * FROM MSFT_PhysicalDisk"))
            {
                int? media = Wmi.Int(d, "MediaType");
                int? bus = Wmi.Int(d, "BusType");
                string tipo = bus == 17 ? "NVMe" : media == 4 ? "SSD" : media == 3 ? "HDD" : media == 5 ? "SCM" : "Desconocido";

                Dictionary<string, object> r = new Dictionary<string, object>();
                r["modelo"] = Wmi.Str(d, "FriendlyName") ?? Wmi.Str(d, "Model");
                r["numeroSerie"] = Texto.Limpiar(Wmi.Str(d, "SerialNumber"));
                r["capacidadBytes"] = Wmi.Long(d, "Size");
                r["tipo"] = tipo;
                r["interfaz"] = NombreBus(bus);
                r["externo"] = bus == 7;
                r["firmware"] = Wmi.Str(d, "FirmwareVersion");
                r["salud"] = SaludDisco(Wmi.Int(d, "HealthStatus"));
                l.Add(r);
            }

            if (l.Count == 0)
            {
                foreach (ManagementBaseObject d in Wmi.Consultar("SELECT * FROM Win32_DiskDrive"))
                {
                    Dictionary<string, object> r = new Dictionary<string, object>();
                    string modelo = Wmi.Str(d, "Model");
                    r["modelo"] = modelo;
                    r["numeroSerie"] = Texto.Limpiar(Wmi.Str(d, "SerialNumber"));
                    r["capacidadBytes"] = Wmi.Long(d, "Size");
                    r["tipo"] = Texto.Contiene(modelo, "ssd", "nvme") ? "SSD" : "Desconocido";
                    r["interfaz"] = Wmi.Str(d, "InterfaceType");
                    r["externo"] = Wmi.Str(d, "InterfaceType") == "USB";
                    r["firmware"] = Wmi.Str(d, "FirmwareRevision");
                    r["salud"] = Wmi.Str(d, "Status");
                    l.Add(r);
                }
            }
            return l;
        }

        static string NombreBus(int? b)
        {
            switch (b ?? -1)
            {
                case 1: return "SCSI";
                case 3: return "ATA";
                case 7: return "USB";
                case 8: return "RAID";
                case 10: return "SAS";
                case 11: return "SATA";
                case 12: return "SD";
                case 13: return "MMC";
                case 15: return "Virtual";
                case 17: return "NVMe";
                default: return null;
            }
        }

        static string SaludDisco(int? h)
        {
            if (h == 0) return "Correcto";
            if (h == 1) return "Advertencia";
            if (h == 2) return "Dañado";
            return null;
        }

        static object Volumenes()
        {
            List<object> l = new List<object>();
            foreach (ManagementBaseObject v in Wmi.Consultar("SELECT * FROM Win32_LogicalDisk WHERE DriveType=3"))
            {
                Dictionary<string, object> r = new Dictionary<string, object>();
                r["letra"] = Wmi.Str(v, "DeviceID");
                r["etiqueta"] = Wmi.Str(v, "VolumeName");
                r["sistemaArchivos"] = Wmi.Str(v, "FileSystem");
                r["capacidadBytes"] = Wmi.Long(v, "Size");
                r["libreBytes"] = Wmi.Long(v, "FreeSpace");
                l.Add(r);
            }
            return l;
        }

        // ------------------------------------------------------------------ PLACA / BIOS
        static object PlacaBase()
        {
            ManagementBaseObject b = Wmi.Primero("SELECT * FROM Win32_BaseBoard");
            Dictionary<string, object> r = new Dictionary<string, object>();
            r["fabricante"] = Texto.Limpiar(Wmi.Str(b, "Manufacturer"));
            r["modelo"] = Texto.Limpiar(Wmi.Str(b, "Product"));
            r["version"] = Texto.Limpiar(Wmi.Str(b, "Version"));
            r["numeroSerie"] = Texto.Limpiar(Wmi.Str(b, "SerialNumber"));
            return r;
        }

        static object Bios()
        {
            ManagementBaseObject b = Wmi.Primero("SELECT * FROM Win32_BIOS");
            Dictionary<string, object> r = new Dictionary<string, object>();
            r["fabricante"] = Wmi.Str(b, "Manufacturer");
            r["version"] = Wmi.Str(b, "SMBIOSBIOSVersion");
            r["fecha"] = Wmi.Fecha(b, "ReleaseDate");
            r["versionSMBIOS"] = Wmi.Str(b, "SMBIOSMajorVersion") + "." + Wmi.Str(b, "SMBIOSMinorVersion");

            string modo = null;
            string fwEnv = Environment.GetEnvironmentVariable("firmware_type"); // "UEFI" o "Legacy"
            if (!string.IsNullOrEmpty(fwEnv)) modo = fwEnv == "UEFI" ? "UEFI" : "Legacy BIOS";
            if (modo == null) try
            {
                using (RegistryKey k = Registry.LocalMachine.OpenSubKey(@"SYSTEM\CurrentControlSet\Control"))
                {
                    object fw = k == null ? null : k.GetValue("PEFirmwareType"); // 1 = BIOS, 2 = UEFI
                    if (fw != null) modo = Convert.ToInt32(fw) == 2 ? "UEFI" : "Legacy BIOS";
                }
            }
            catch { }
            r["modoArranque"] = modo;
            return r;
        }

        // ------------------------------------------------------------------ GRÁFICOS / MONITORES
        static object Graficos()
        {
            Dictionary<string, long> memoriaReal = MemoriaGpuRegistro();
            List<object> l = new List<object>();
            foreach (ManagementBaseObject g in Wmi.Consultar("SELECT * FROM Win32_VideoController"))
            {
                string nombre = Wmi.Str(g, "Name");
                // AdapterRAM es uint32 (se queda en 4 GB): el registro tiene el valor real.
                long mem;
                long? memoria = nombre != null && memoriaReal.TryGetValue(nombre, out mem) ? mem : Wmi.Long(g, "AdapterRAM");

                Dictionary<string, object> r = new Dictionary<string, object>();
                r["nombre"] = nombre;
                r["fabricante"] = Wmi.Str(g, "AdapterCompatibility");
                r["memoriaBytes"] = memoria;
                r["versionDriver"] = Wmi.Str(g, "DriverVersion");
                r["resolucion"] = Wmi.Int(g, "CurrentHorizontalResolution") != null
                    ? Wmi.Str(g, "CurrentHorizontalResolution") + "x" + Wmi.Str(g, "CurrentVerticalResolution")
                    : null;
                r["frecuenciaHz"] = Wmi.Int(g, "CurrentRefreshRate");
                l.Add(r);
            }
            return l;
        }

        static Dictionary<string, long> MemoriaGpuRegistro()
        {
            Dictionary<string, long> r = new Dictionary<string, long>();
            try
            {
                using (RegistryKey clase = RegistryKey.OpenBaseKey(RegistryHive.LocalMachine, RegistryView.Registry64)
                    .OpenSubKey(@"SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}"))
                {
                    if (clase == null) return r;
                    foreach (string sub in clase.GetSubKeyNames())
                    {
                        try
                        {
                            using (RegistryKey k = clase.OpenSubKey(sub))
                            {
                                if (k == null) continue;
                                string desc = k.GetValue("DriverDesc") as string;
                                if (desc == null) continue;
                                object q = k.GetValue("HardwareInformation.qwMemorySize");
                                object m = k.GetValue("HardwareInformation.MemorySize");
                                long valor = 0;
                                if (q != null) valor = Convert.ToInt64(q);
                                else if (m is byte[] && ((byte[])m).Length >= 4) valor = BitConverter.ToUInt32((byte[])m, 0);
                                else if (m != null) valor = Convert.ToInt64(m);
                                if (valor > 0) r[desc] = valor;
                            }
                        }
                        catch { }
                    }
                }
            }
            catch { }
            return r;
        }

        static object Monitores()
        {
            List<object> l = new List<object>();
            foreach (ManagementBaseObject m in Wmi.Consultar(@"root\wmi", "SELECT * FROM WmiMonitorID"))
            {
                Dictionary<string, object> r = new Dictionary<string, object>();
                r["fabricante"] = Wmi.TextoDeArreglo(m, "ManufacturerName");
                r["modelo"] = Wmi.TextoDeArreglo(m, "UserFriendlyName");
                r["codigoProducto"] = Wmi.TextoDeArreglo(m, "ProductCodeID");
                r["numeroSerie"] = Texto.Limpiar(Wmi.TextoDeArreglo(m, "SerialNumberID"));
                r["anioFabricacion"] = Wmi.Int(m, "YearOfManufacture");
                l.Add(r);
            }
            return l;
        }

        // ------------------------------------------------------------------ RED
        static object Red()
        {
            Dictionary<int, ManagementBaseObject> configs = new Dictionary<int, ManagementBaseObject>();
            foreach (ManagementBaseObject c in Wmi.Consultar("SELECT * FROM Win32_NetworkAdapterConfiguration"))
            {
                int? idx = Wmi.Int(c, "Index");
                if (idx.HasValue) configs[idx.Value] = c;
            }

            List<object> l = new List<object>();
            foreach (ManagementBaseObject a in Wmi.Consultar("SELECT * FROM Win32_NetworkAdapter WHERE PhysicalAdapter=TRUE AND MACAddress IS NOT NULL"))
            {
                string nombre = Wmi.Str(a, "Name");
                // Descarta adaptadores virtuales que algunos drivers marcan como físicos.
                if (Texto.Contiene(nombre, "virtual", "vmware", "hyper-v", "bluetooth", "wan miniport", "tap-", "vpn")) continue;

                ManagementBaseObject cfg = null;
                int? idx = Wmi.Int(a, "Index");
                if (idx.HasValue) configs.TryGetValue(idx.Value, out cfg);

                List<string> ips = new List<string>();
                string[] arrIp = Wmi.Valor(cfg, "IPAddress") as string[];
                if (arrIp != null) ips.AddRange(arrIp);

                Dictionary<string, object> r = new Dictionary<string, object>();
                r["nombre"] = nombre;
                r["conexion"] = Wmi.Str(a, "NetConnectionID");
                r["mac"] = Wmi.Str(a, "MACAddress");
                r["tipo"] = Texto.Contiene(nombre, "wi-fi", "wifi", "wireless", "wlan", "802.11") ? "Wi-Fi" : "Ethernet";
                r["conectado"] = Wmi.Int(a, "NetConnectionStatus") == 2;
                long? vel = Wmi.Long(a, "Speed");
                r["velocidadBps"] = vel.HasValue && vel.Value > 0 && vel.Value < long.MaxValue ? vel : null; // desconectado = Int64.Max
                r["ips"] = ips;
                r["dhcp"] = Wmi.Bool(cfg, "DHCPEnabled");
                l.Add(r);
            }
            return l;
        }

        // ------------------------------------------------------------------ BATERÍA
        static object Bateria()
        {
            ManagementBaseObject b = Wmi.Primero("SELECT * FROM Win32_Battery");
            if (b == null) return null;

            Dictionary<string, object> r = new Dictionary<string, object>();
            r["nombre"] = Wmi.Str(b, "Name");
            r["cargaPorcentaje"] = Wmi.Int(b, "EstimatedChargeRemaining");

            // Salud = capacidad actual / capacidad de diseño (puede requerir permisos de administrador).
            ManagementBaseObject est = null, full = null;
            List<ManagementBaseObject> l1 = Wmi.Consultar(@"root\wmi", "SELECT DesignedCapacity FROM BatteryStaticData");
            List<ManagementBaseObject> l2 = Wmi.Consultar(@"root\wmi", "SELECT FullChargedCapacity FROM BatteryFullChargedCapacity");
            if (l1.Count > 0) est = l1[0];
            if (l2.Count > 0) full = l2[0];
            long? diseno = Wmi.Long(est, "DesignedCapacity");
            long? actual = Wmi.Long(full, "FullChargedCapacity");
            r["capacidadDisenoMWh"] = diseno;
            r["capacidadActualMWh"] = actual;
            r["saludPorcentaje"] = diseno > 0 && actual.HasValue ? (object)(int)Math.Round(actual.Value * 100.0 / diseno.Value) : null;
            return r;
        }

        // ------------------------------------------------------------------ ANTIVIRUS
        static object Antivirus()
        {
            List<object> l = new List<object>();
            foreach (ManagementBaseObject a in Wmi.Consultar(@"root\SecurityCenter2", "SELECT * FROM AntiVirusProduct"))
            {
                int estado = Wmi.Int(a, "productState") ?? 0;
                Dictionary<string, object> r = new Dictionary<string, object>();
                r["nombre"] = Wmi.Str(a, "displayName");
                // productState: byte medio 0x10 = activado; byte bajo 0x00 = firmas al día.
                r["activo"] = ((estado >> 8) & 0x10) == 0x10;
                r["actualizado"] = (estado & 0xFF) == 0x00;
                l.Add(r);
            }
            return l;
        }

        // ------------------------------------------------------------------ SOFTWARE
        static object Software()
        {
            Dictionary<string, Dictionary<string, object>> unicos = new Dictionary<string, Dictionary<string, object>>();
            LeerDesinstalar(RegistryHive.LocalMachine, RegistryView.Registry64, unicos);
            LeerDesinstalar(RegistryHive.LocalMachine, RegistryView.Registry32, unicos);
            LeerDesinstalar(RegistryHive.CurrentUser, RegistryView.Default, unicos);

            List<Dictionary<string, object>> l = new List<Dictionary<string, object>>(unicos.Values);
            l.Sort(delegate(Dictionary<string, object> a, Dictionary<string, object> b)
            {
                return string.Compare((string)a["nombre"], (string)b["nombre"], StringComparison.OrdinalIgnoreCase);
            });
            return l;
        }

        static void LeerDesinstalar(RegistryHive hive, RegistryView vista, Dictionary<string, Dictionary<string, object>> destino)
        {
            try
            {
                using (RegistryKey raiz = RegistryKey.OpenBaseKey(hive, vista).OpenSubKey(@"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall"))
                {
                    if (raiz == null) return;
                    foreach (string sub in raiz.GetSubKeyNames())
                    {
                        try
                        {
                            using (RegistryKey k = raiz.OpenSubKey(sub))
                            {
                                if (k == null) continue;
                                string nombre = k.GetValue("DisplayName") as string;
                                if (string.IsNullOrEmpty(nombre)) continue;
                                object sc = k.GetValue("SystemComponent");
                                if (sc != null && Convert.ToInt32(sc) == 1) continue;   // componentes internos
                                if (k.GetValue("ParentKeyName") != null) continue;       // actualizaciones/parches

                                string version = k.GetValue("DisplayVersion") as string;
                                string clave = nombre.Trim().ToLowerInvariant() + "|" + (version ?? "");
                                if (destino.ContainsKey(clave)) continue;

                                Dictionary<string, object> r = new Dictionary<string, object>();
                                r["nombre"] = nombre.Trim();
                                r["version"] = version;
                                r["editor"] = k.GetValue("Publisher") as string;
                                r["fechaInstalacion"] = k.GetValue("InstallDate") as string; // yyyyMMdd
                                destino[clave] = r;
                            }
                        }
                        catch { }
                    }
                }
            }
            catch { }
        }
    }
}
