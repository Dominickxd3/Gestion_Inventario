import { NotFoundException } from '@nestjs/common';
import { DataSource, DeepPartial, EntityTarget, FindManyOptions, FindOptionsWhere, ObjectLiteral } from 'typeorm';

/**
 * Altas y ediciones de tablas maestras (marcas, sedes, personas…). Sin borrado: se desactivan con `activo`.
 * La auditoría la registra el interceptor global; los duplicados los traduce ErroresSqlFilter a 409.
 */
export class CrudSimple<T extends ObjectLiteral & { id: string }> {
  constructor(
    private readonly db: DataSource,
    private readonly entidad: EntityTarget<T>,
    private readonly nombre: string,
  ) {}

  private get repo() {
    return this.db.getRepository(this.entidad);
  }

  listar(opciones: FindManyOptions<T> = {}) {
    return this.repo.find(opciones);
  }

  async obtener(id: string, relations?: string[]) {
    const r = await this.repo.findOne({ where: { id } as FindOptionsWhere<T>, relations });
    if (!r) throw new NotFoundException(`${this.nombre} no encontrado`);
    return r;
  }

  async crear(datos: DeepPartial<T>, creadoPor: string | null) {
    return this.repo.save(this.repo.create({ ...datos, creadoPor } as DeepPartial<T>));
  }

  async actualizar(id: string, datos: DeepPartial<T>) {
    const r = await this.obtener(id);
    // Solo se copian las propiedades presentes en el DTO (undefined = no tocar).
    const cambios = Object.fromEntries(Object.entries(datos).filter(([, v]) => v !== undefined));
    return this.repo.save(this.repo.merge(r, cambios as DeepPartial<T>));
  }
}
