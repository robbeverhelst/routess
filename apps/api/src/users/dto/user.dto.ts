import { IsOptional } from "class-validator";

export class CreateUserDto {
  email!: string;
  name!: string;
  password!: string;
}

export class UpdateUserDto {
  @IsOptional()
  email?: string;

  @IsOptional()
  name?: string;

  @IsOptional()
  password?: string;

  @IsOptional()
  avatar?: string;
}
