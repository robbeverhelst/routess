export class CreateUserDto {
  email!: string;
  name!: string;
  password!: string;
}

export class UpdateUserDto {
  email?: string;
  name?: string;
  password?: string;
}
