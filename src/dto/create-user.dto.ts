import { IsEmail } from "../pipes/validation.pipe.js";

export class CreateUserDto {
  @IsEmail()
  email!: string;
}
