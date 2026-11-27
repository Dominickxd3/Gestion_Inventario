import { Transform } from 'class-transformer';
import { IsBoolean, IsEmail, IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { LONGITUD_MINIMA_PASSWORD } from './password';
import { ROLES, type Rol } from './usuario.entity';

const recortar = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const nombreUsuario = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() : value);

export class LoginDto {
  @Transform(nombreUsuario) @IsString() @MinLength(1) @MaxLength(64) usuario: string;
  @IsString() @MinLength(1) @MaxLength(256) password: string;
}

export class CambiarPasswordDto {
  @IsString() @MaxLength(256) actual: string;
  @IsString()
  @MinLength(LONGITUD_MINIMA_PASSWORD, { message: `La contraseña nueva debe tener al menos ${LONGITUD_MINIMA_PASSWORD} caracteres` })
  @MaxLength(256)
  nueva: string;
}

export class CrearUsuarioDto {
  @Transform(nombreUsuario)
  @Matches(/^[a-z0-9._-]{3,64}$/, { message: 'El usuario solo admite letras, números, punto, guion y guion bajo (3 a 64)' })
  nombreUsuario: string;

  @Transform(recortar) @IsString() @MinLength(1) @MaxLength(128) nombre: string;
  @IsOptional() @Transform(recortar) @IsEmail() @MaxLength(256) correo?: string | null;
  @IsIn(ROLES) rol: Rol;
}

export class ActualizarUsuarioDto {
  @IsOptional() @Transform(recortar) @IsString() @MinLength(1) @MaxLength(128) nombre?: string;
  @IsOptional() @Transform(recortar) @IsEmail() @MaxLength(256) correo?: string | null;
  @IsOptional() @IsIn(ROLES) rol?: Rol;
  @IsOptional() @IsBoolean() activo?: boolean;
}
