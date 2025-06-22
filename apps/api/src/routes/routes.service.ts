import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@mikro-orm/nestjs";
import { EntityManager, EntityRepository } from "@mikro-orm/core";
import { Route } from "../entities/route.entity";
import { CreateRouteDto } from "./dto/create-route.dto";
import { UpdateRouteDto } from "./dto/update-route.dto";

@Injectable()
export class RoutesService {
  constructor(
    @InjectRepository(Route)
    private readonly routeRepository: EntityRepository<Route>,
    private readonly em: EntityManager,
  ) {}

  async create(createRouteDto: CreateRouteDto, userId: number): Promise<Route> {
    const route = this.routeRepository.create({
      ...createRouteDto,
      user: userId,
    });

    await this.em.persistAndFlush(route);
    return route;
  }

  async findAll(userId: number): Promise<Route[]> {
    return this.routeRepository.find({ user: userId });
  }

  async findOne(id: number, userId: number): Promise<Route> {
    const route = await this.routeRepository.findOne({ id, user: userId });

    if (!route) {
      throw new NotFoundException(`Route with ID ${id} not found`);
    }

    return route;
  }

  async update(id: number, updateRouteDto: UpdateRouteDto, userId: number): Promise<Route> {
    const route = await this.findOne(id, userId);

    this.routeRepository.assign(route, updateRouteDto);
    await this.em.persistAndFlush(route);

    return route;
  }

  async remove(id: number, userId: number): Promise<void> {
    const route = await this.findOne(id, userId);
    await this.em.removeAndFlush(route);
  }
}
