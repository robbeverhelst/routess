import { Injectable } from '@nestjs/common';
import {
  EntityManager,
  EntityRepository,
  MikroORM,
} from '@mikro-orm/postgresql';

export interface DatabaseServices {
  orm: MikroORM;
  em: EntityManager;
}

@Injectable()
export class DatabaseService {
  private cache: DatabaseServices;

  constructor(private readonly orm: MikroORM) {
    this.cache = {
      orm: this.orm,
      em: this.orm.em,
    };
  }

  getServices(): DatabaseServices {
    return this.cache;
  }

  getEntityManager(): EntityManager {
    return this.orm.em;
  }

  getRepository<T extends object>(entity: new () => T): EntityRepository<T> {
    return this.orm.em.getRepository(entity);
  }
} 