import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { alInvalidarSesion, ApiError, tokenSesion } from '../services/http';
import { authService } from '../services/auth.service';
import type { Rol, UsuarioPlataforma } from '../types/identidad';

type Estado =
  | { tipo: 'comprobando' }
  | { tipo: 'sin-sesion'; motivo?: string }
  | { tipo: 'con-sesion'; usuario: UsuarioPlataforma };

interface ValorSesion {
  estado: Estado;
  usuario: UsuarioPlataforma | null;
  iniciar: (usuario: string, password: string) => Promise<void>;
  cambiarPassword: (actual: string, nueva: string) => Promise<void>;
  cerrar: () => void;
  /** El usuario tiene alguno de estos roles. */
  puede: (...roles: Rol[]) => boolean;
}

const Contexto = createContext<ValorSesion | null>(null);

export function SesionProvider({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<Estado>(() => (tokenSesion.obtener() ? { tipo: 'comprobando' } : { tipo: 'sin-sesion' }));

  // Al cargar, valida el token guardado.
  useEffect(() => {
    if (estado.tipo !== 'comprobando') return;
    const control = new AbortController();
    authService
      .yo(control.signal)
      .then((usuario) => setEstado({ tipo: 'con-sesion', usuario }))
      .catch((e: Error) => {
        if (e.name === 'AbortError') return;
        if (e instanceof ApiError && e.tipo === 'no-autenticado') setEstado({ tipo: 'sin-sesion' });
        else setEstado({ tipo: 'sin-sesion', motivo: e.message });
      });
    return () => control.abort();
  }, [estado.tipo]);

  useEffect(
    () => alInvalidarSesion(() => setEstado({ tipo: 'sin-sesion', motivo: 'Tu sesión terminó. Vuelve a iniciar sesión.' })),
    [],
  );

  const iniciar = useCallback(async (usuario: string, password: string) => {
    const r = await authService.login(usuario, password);
    tokenSesion.guardar(r.token);
    setEstado({ tipo: 'con-sesion', usuario: r.usuario });
  }, []);

  const cambiarPassword = useCallback(async (actual: string, nueva: string) => {
    const r = await authService.cambiarPassword(actual, nueva);
    tokenSesion.guardar(r.token);
    setEstado({ tipo: 'con-sesion', usuario: r.usuario });
  }, []);

  const cerrar = useCallback(() => {
    tokenSesion.guardar(null);
    setEstado({ tipo: 'sin-sesion' });
  }, []);

  const valor = useMemo<ValorSesion>(() => {
    const usuario = estado.tipo === 'con-sesion' ? estado.usuario : null;
    return { estado, usuario, iniciar, cambiarPassword, cerrar, puede: (...roles) => !!usuario && roles.includes(usuario.rol) };
  }, [estado, iniciar, cambiarPassword, cerrar]);

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useSesion() {
  const v = useContext(Contexto);
  if (!v) throw new Error('useSesion debe usarse dentro de SesionProvider');
  return v;
}
