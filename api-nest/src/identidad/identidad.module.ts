import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { AuthController, UsuariosController } from './identidad.controller';
import { Usuario } from './usuario.entity';
import { UsuariosService } from './usuarios.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Usuario]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const secret = config.get<string>('JWT_SECRET');
        if (!secret || secret.length < 32) throw new Error('JWT_SECRET falta o es demasiado corto (mínimo 32 caracteres)');
        return { secret, signOptions: { expiresIn: (config.get<string>('JWT_EXPIRES_IN') ?? '8h') as '8h' } };
      },
    }),
  ],
  controllers: [AuthController, UsuariosController],
  providers: [AuthService, UsuariosService, { provide: APP_GUARD, useClass: AuthGuard }],
})
export class IdentidadModule {}
