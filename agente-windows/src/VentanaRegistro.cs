using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Threading;
using System.Windows.Forms;

namespace InventarioAgente
{
    enum EstadoPaso { Pendiente, EnCurso, Hecho, Error }

    /// <summary>Indicador circular dibujado (sin emojis ni imágenes).</summary>
    class Indicador : Control
    {
        EstadoPaso estado = EstadoPaso.Pendiente;
        public float Angulo;

        public Indicador()
        {
            SetStyle(ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer |
                     ControlStyles.UserPaint | ControlStyles.SupportsTransparentBackColor, true);
            BackColor = Color.Transparent;
        }

        public EstadoPaso Estado
        {
            get { return estado; }
            set { estado = value; Invalidate(); }
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            Graphics g = e.Graphics;
            g.SmoothingMode = SmoothingMode.AntiAlias;
            float s = Math.Min(Width, Height) - 2;
            RectangleF r = new RectangleF(1, 1, s, s);
            float grosor = Math.Max(1.5f, s / 9f);

            switch (estado)
            {
                case EstadoPaso.Pendiente:
                    using (Pen p = new Pen(Colores.Borde, grosor)) g.DrawEllipse(p, r);
                    break;

                case EstadoPaso.EnCurso:
                    using (Pen fondo = new Pen(Colores.AzulClaro, grosor)) g.DrawEllipse(fondo, r);
                    using (Pen p = new Pen(Colores.Azul, grosor)) g.DrawArc(p, r, Angulo, 100);
                    break;

                case EstadoPaso.Hecho:
                    using (Brush b = new SolidBrush(Colores.Verde)) g.FillEllipse(b, r);
                    using (Pen p = new Pen(Color.White, grosor) { StartCap = LineCap.Round, EndCap = LineCap.Round, LineJoin = LineJoin.Round })
                    {
                        g.DrawLines(p, new PointF[] {
                            new PointF(r.X + s * 0.28f, r.Y + s * 0.52f),
                            new PointF(r.X + s * 0.44f, r.Y + s * 0.68f),
                            new PointF(r.X + s * 0.73f, r.Y + s * 0.36f)
                        });
                    }
                    break;

                case EstadoPaso.Error:
                    using (Brush b = new SolidBrush(Colores.Rojo)) g.FillEllipse(b, r);
                    using (Pen p = new Pen(Color.White, grosor) { StartCap = LineCap.Round, EndCap = LineCap.Round })
                    {
                        float a = s * 0.33f, z = s * 0.67f;
                        g.DrawLine(p, r.X + a, r.Y + a, r.X + z, r.Y + z);
                        g.DrawLine(p, r.X + z, r.Y + a, r.X + a, r.Y + z);
                    }
                    break;
            }
        }
    }

    static class Colores
    {
        public static readonly Color Marca = Color.FromArgb(30, 58, 138);
        public static readonly Color MarcaTexto = Color.FromArgb(191, 219, 254);
        public static readonly Color Azul = Color.FromArgb(37, 99, 235);
        public static readonly Color AzulClaro = Color.FromArgb(219, 234, 254);
        public static readonly Color Verde = Color.FromArgb(22, 163, 74);
        public static readonly Color VerdeFondo = Color.FromArgb(240, 253, 244);
        public static readonly Color Rojo = Color.FromArgb(220, 38, 38);
        public static readonly Color RojoFondo = Color.FromArgb(254, 242, 242);
        public static readonly Color Texto = Color.FromArgb(30, 41, 59);
        public static readonly Color Gris = Color.FromArgb(100, 116, 139);
        public static readonly Color GrisClaro = Color.FromArgb(148, 163, 184);
        public static readonly Color Borde = Color.FromArgb(203, 213, 225);
        public static readonly Color Pista = Color.FromArgb(226, 232, 240);
    }

    /// <summary>Ventana que ve el usuario al abrir ScanGP con doble clic.</summary>
    class VentanaRegistro : Form
    {
        public int Codigo = 1;

        readonly Config cfg;
        readonly List<Indicador> indicadores = new List<Indicador>();
        readonly List<Label> etiquetas = new List<Label>();
        readonly Panel pista = new Panel();
        readonly Panel barra = new Panel();
        readonly Panel panelResultado = new Panel();
        readonly Label lblTitulo = new Label();
        readonly Label lblDetalle = new Label();
        readonly Button btnCerrar = new Button();
        readonly Button btnReintentar = new Button();
        readonly System.Windows.Forms.Timer animacion = new System.Windows.Forms.Timer();
        int pasoActual = -1;
        bool trabajando;
        Color acentoResultado;

        public VentanaRegistro(Config cfg)
        {
            this.cfg = cfg;
            Construir();
        }

        void Construir()
        {
            SuspendLayout();
            Font fuente = new Font("Segoe UI", 9.75f);

            // Cabecera con la marca: logo (si se compiló con assets\scangp.png) + nombre
            Panel cabecera = new Panel { Dock = DockStyle.Top, Height = 76, BackColor = Color.White };
            cabecera.Paint += delegate (object s, PaintEventArgs e)
            {
                using (Pen p = new Pen(Colores.Pista)) e.Graphics.DrawLine(p, 0, cabecera.Height - 1, cabecera.Width, cabecera.Height - 1);
            };
            int xTexto = 22;
            Image logo = CargarLogo();
            if (logo != null)
            {
                cabecera.Controls.Add(new PictureBox
                {
                    Image = logo, SizeMode = PictureBoxSizeMode.Zoom, Location = new Point(22, 14), Size = new Size(48, 48)
                });
                xTexto = 82;
            }
            cabecera.Controls.Add(new Label
            {
                Text = Program.Producto, AutoSize = true, ForeColor = Colores.Texto,
                Font = new Font("Segoe UI Semibold", 16f), Location = new Point(xTexto - 3, 10), BackColor = Color.Transparent
            });
            cabecera.Controls.Add(new Label
            {
                Text = "Registro de equipo en el inventario", AutoSize = true, ForeColor = Colores.Gris,
                Font = new Font("Segoe UI", 9.75f), Location = new Point(xTexto, 45), BackColor = Color.Transparent
            });

            Label intro = new Label
            {
                Text = "Estamos leyendo las características de este equipo para registrarlo. " +
                       "No se instala nada y solo toma unos segundos.",
                Location = new Point(24, 92), Size = new Size(412, 40), ForeColor = Colores.Gris, Font = fuente
            };

            int y = 140;
            for (int i = 0; i < Recolector.Pasos.Length; i++)
            {
                Indicador ind = new Indicador { Location = new Point(26, y + 3), Size = new Size(18, 18) };
                Label lbl = new Label
                {
                    Text = Recolector.Pasos[i], Location = new Point(54, y + 1), Size = new Size(380, 22),
                    ForeColor = Colores.GrisClaro, Font = fuente
                };
                indicadores.Add(ind);
                etiquetas.Add(lbl);
                Controls.Add(ind);
                Controls.Add(lbl);
                y += 29;
            }

            // Barra de progreso fina
            pista.Location = new Point(24, y + 8);
            pista.Size = new Size(412, 6);
            pista.BackColor = Colores.Pista;
            barra.Location = new Point(0, 0);
            barra.Size = new Size(0, 6);
            barra.BackColor = Colores.Azul;
            pista.Controls.Add(barra);

            // Resultado
            panelResultado.Location = new Point(24, y + 26);
            panelResultado.Size = new Size(412, 96);
            panelResultado.Visible = false;
            panelResultado.Paint += PintarResultado;
            lblTitulo.Location = new Point(16, 10);
            lblTitulo.Size = new Size(388, 22);
            lblTitulo.Font = new Font("Segoe UI Semibold", 10.5f);
            lblTitulo.BackColor = Color.Transparent;
            lblDetalle.Location = new Point(16, 33);
            lblDetalle.Size = new Size(388, 60);
            lblDetalle.Font = fuente;
            lblDetalle.ForeColor = Colores.Texto;
            lblDetalle.BackColor = Color.Transparent;
            panelResultado.Controls.Add(lblTitulo);
            panelResultado.Controls.Add(lblDetalle);

            int yBotones = y + 136;
            Label lblServidor = new Label
            {
                Text = "v" + Program.Version + "  ·  Servidor: " + Autoridad(cfg.Url),
                Location = new Point(24, yBotones + 8), Size = new Size(210, 18),
                ForeColor = Colores.GrisClaro, Font = new Font("Segoe UI", 8.25f), AutoEllipsis = true
            };

            EstiloBoton(btnReintentar, "Reintentar", false);
            btnReintentar.Location = new Point(238, yBotones);
            btnReintentar.Visible = false;
            btnReintentar.Click += delegate { Iniciar(); };

            EstiloBoton(btnCerrar, "Cancelar", true);
            btnCerrar.Location = new Point(340, yBotones);
            btnCerrar.Click += delegate { Close(); };

            Controls.Add(cabecera);
            Controls.Add(intro);
            Controls.Add(pista);
            Controls.Add(panelResultado);
            Controls.Add(lblServidor);
            Controls.Add(btnReintentar);
            Controls.Add(btnCerrar);

            AutoScaleDimensions = new SizeF(96F, 96F);
            AutoScaleMode = AutoScaleMode.Dpi;
            ClientSize = new Size(460, yBotones + 48);
            BackColor = Color.White;
            Font = fuente;
            FormBorderStyle = FormBorderStyle.FixedSingle;
            MaximizeBox = false;
            StartPosition = FormStartPosition.CenterScreen;
            Text = Program.Producto + " - Registro de equipo";
            try { Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath); } catch { }
            AcceptButton = btnCerrar;

            animacion.Interval = 40;
            animacion.Tick += delegate
            {
                if (pasoActual >= 0 && pasoActual < indicadores.Count && indicadores[pasoActual].Estado == EstadoPaso.EnCurso)
                {
                    indicadores[pasoActual].Angulo = (indicadores[pasoActual].Angulo + 14) % 360;
                    indicadores[pasoActual].Invalidate();
                }
            };

            ResumeLayout(false);
            PerformLayout();
        }

        static Image CargarLogo()
        {
            try
            {
                System.IO.Stream s = typeof(VentanaRegistro).Assembly.GetManifestResourceStream("ScanGP.logo.png");
                return s == null ? null : Image.FromStream(s);
            }
            catch { return null; }
        }

        static void EstiloBoton(Button b, string texto, bool principal)
        {
            b.Text = texto;
            b.Size = new Size(96, 32);
            b.FlatStyle = FlatStyle.Flat;
            b.Cursor = Cursors.Hand;
            b.Font = new Font("Segoe UI Semibold", 9.75f);
            if (principal)
            {
                b.BackColor = Colores.Azul;
                b.ForeColor = Color.White;
                b.FlatAppearance.BorderSize = 0;
                b.FlatAppearance.MouseOverBackColor = Color.FromArgb(29, 78, 216);
            }
            else
            {
                b.BackColor = Color.White;
                b.ForeColor = Colores.Texto;
                b.FlatAppearance.BorderColor = Colores.Borde;
                b.FlatAppearance.MouseOverBackColor = Color.FromArgb(248, 250, 252);
            }
        }

        void PintarResultado(object sender, PaintEventArgs e)
        {
            Rectangle r = panelResultado.ClientRectangle;
            using (Pen p = new Pen(Color.FromArgb(60, acentoResultado))) e.Graphics.DrawRectangle(p, 0, 0, r.Width - 1, r.Height - 1);
            using (Brush b = new SolidBrush(acentoResultado)) e.Graphics.FillRectangle(b, 0, 0, Math.Max(3, r.Width / 120), r.Height);
        }

        protected override void OnShown(EventArgs e)
        {
            base.OnShown(e);
            Iniciar();
        }

        void Iniciar()
        {
            if (trabajando) return;
            trabajando = true;
            pasoActual = -1;
            foreach (Indicador i in indicadores) i.Estado = EstadoPaso.Pendiente;
            foreach (Label l in etiquetas) { l.ForeColor = Colores.GrisClaro; l.Font = Font; }
            panelResultado.Visible = false;
            btnReintentar.Visible = false;
            btnCerrar.Text = "Cancelar";
            barra.Width = 0;
            animacion.Start();

            Thread t = new Thread(delegate ()
            {
                Resultado r = Program.Ejecutar(cfg, delegate (int paso) { EnUI(delegate { MarcarPaso(paso); }); });
                EnUI(delegate { Finalizar(r); });
            });
            t.IsBackground = true;
            t.Start();
        }

        void EnUI(MethodInvoker accion)
        {
            try { if (!IsDisposed && IsHandleCreated) BeginInvoke(accion); } catch { }
        }

        void MarcarPaso(int paso)
        {
            for (int i = 0; i < indicadores.Count; i++)
            {
                if (i < paso) { indicadores[i].Estado = EstadoPaso.Hecho; etiquetas[i].ForeColor = Colores.Texto; etiquetas[i].Font = Font; }
                else if (i == paso)
                {
                    indicadores[i].Estado = EstadoPaso.EnCurso;
                    etiquetas[i].ForeColor = Colores.Texto;
                    etiquetas[i].Font = new Font(Font, FontStyle.Bold);
                }
            }
            pasoActual = paso;
            barra.Width = pista.Width * paso / indicadores.Count;
        }

        void Finalizar(Resultado r)
        {
            trabajando = false;
            animacion.Stop();
            Codigo = r.Codigo;

            if (r.Codigo == 0)
            {
                MarcarPaso(indicadores.Count);
                barra.Width = pista.Width;
                barra.BackColor = Colores.Verde;
                acentoResultado = Colores.Verde;
                panelResultado.BackColor = Colores.VerdeFondo;
                lblTitulo.ForeColor = Colores.Verde;
                lblTitulo.Text = r.EquipoNuevo == false ? "Equipo actualizado" : "Equipo registrado";
                lblDetalle.Text = DescribirEquipo(r.Equipo) +
                    (r.EquipoNuevo == false ? "\nYa estaba en el inventario; se actualizaron sus datos." : "\nEl equipo ya aparece en la web.");
                IniciarCierreAutomatico();
            }
            else
            {
                if (pasoActual >= 0 && pasoActual < indicadores.Count)
                {
                    indicadores[pasoActual].Estado = EstadoPaso.Error;
                    etiquetas[pasoActual].ForeColor = Colores.Rojo;
                }
                barra.BackColor = Colores.Rojo;
                acentoResultado = Colores.Rojo;
                panelResultado.BackColor = Colores.RojoFondo;
                lblTitulo.ForeColor = Colores.Rojo;
                lblTitulo.Text = "No se pudo registrar el equipo";
                lblDetalle.Text = r.Mensaje;
                btnReintentar.Visible = true;
                btnCerrar.Text = "Cerrar";
            }
            panelResultado.Visible = true;
            panelResultado.Invalidate();
            btnCerrar.Focus();
        }

        /// <summary>Tras un registro correcto la ventana se cierra sola; el botón permite cerrarla antes.</summary>
        void IniciarCierreAutomatico()
        {
            int restantes = SegundosCierre;
            btnCerrar.Text = "Cerrar (" + restantes + ")";
            System.Windows.Forms.Timer t = new System.Windows.Forms.Timer { Interval = 1000 };
            t.Tick += delegate
            {
                restantes--;
                if (restantes <= 0) { t.Stop(); Close(); return; }
                btnCerrar.Text = "Cerrar (" + restantes + ")";
            };
            t.Start();
        }

        const int SegundosCierre = 4;

        static string DescribirEquipo(Dictionary<string, object> eq)
        {
            if (eq == null) return "";
            List<string> partes = new List<string>();
            Agregar(partes, eq, "nombreEquipo");
            object tipo;
            if (eq.TryGetValue("tipo", out tipo) && tipo != null) partes.Add(TipoLegible(tipo.ToString()));
            string marca = ((Val(eq, "fabricante") ?? "") + " " + (Val(eq, "modelo") ?? "")).Trim();
            if (marca.Length > 0) partes.Add(marca);
            return string.Join("  ·  ", partes.ToArray());
        }

        static void Agregar(List<string> l, Dictionary<string, object> d, string k)
        {
            string v = Val(d, k);
            if (v != null) l.Add(v);
        }

        static string Val(Dictionary<string, object> d, string k)
        {
            object o;
            return d.TryGetValue(k, out o) && o != null ? o.ToString() : null;
        }

        public static string TipoLegible(string t)
        {
            switch (t)
            {
                case "LAPTOP": return "Laptop";
                case "ESCRITORIO": return "PC de escritorio";
                case "ALL_IN_ONE": return "All-in-One";
                case "TABLET": return "Tablet";
                case "SERVIDOR": return "Servidor";
                case "VIRTUAL": return "Máquina virtual";
                default: return "Tipo desconocido";
            }
        }

        static string Autoridad(string url)
        {
            try { return new Uri(url).Authority; } catch { return url; }
        }
    }
}
