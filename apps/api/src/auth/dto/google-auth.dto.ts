import { IsString, IsNotEmpty } from "class-validator";

export class GoogleAuthDto {
  @IsString()
  @IsNotEmpty()
  credential!: string;
}
