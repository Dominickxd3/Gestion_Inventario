import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { AuditoriaPropia } from '../auditoria/auditoria.interceptor';
import { AuthService } from './auth.service';
import { ipCliente, Publico, Roles, UsuarioActual, type UsuarioSesion } from './decoradores';
import { ActualizarUsuarioDto, CambiarPasswordDto, CrearUsuarioDto, LoginDto } from './dto';
import { UsuariosService } from './usuarios.service';

const actorDe = (u: UsuarioSesion, req: Request) => ({ id: u.id, nombreUsuario: u.nombreUsuario, ip: ipCliente(req) });

@Controller('auth')
@AuditoriaPropia()
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Publico()
  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.auth.login(dto.usuario, dto.password, ipCliente(req));
  }

  @Get('yo')
  yo(@UsuarioActual() u: UsuarioSesion) {
    return this.auth.yo(u.id);
  }

  @Post('cambiar-password')
  @HttpCode(200)
  cambiarPassword(@UsuarioActual() u: UsuarioSesion, @Body() dto: CambiarPasswordDto, @Req() req: Request) {
    return this.auth.cambiarPassword(actorDe(u, req), dto.actual, dto.nueva);
  }
}

@Controller('usuarios')
@Roles('ADMIN')
@AuditoriaPropia()
export class UsuariosController {
  constructor(private readonly usuarios: UsuariosService) {}

  @Get()
  listar() {
    return this.usuarios.listar();
  }

  @Post()
  crear(@UsuarioActual() u: UsuarioSesion, @Body() dto: CrearUsuarioDto, @Req() req: Request) {
    return this.usuarios.crear(actorDe(u, req), dto);
  }

  @Patch(':id')
  actualizar(
    @UsuarioActual() u: UsuarioSesion,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarUsuarioDto,
    @Req() req: Request,
  ) {
    return this.usuarios.actualizar(actorDe(u, req), id, dto);
  }

  @Post(':id/restablecer-password')
  @HttpCode(200)
  restablecer(@UsuarioActual() u: UsuarioSesion, @Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.usuarios.restablecerPassword(actorDe(u, req), id);
  }
}
