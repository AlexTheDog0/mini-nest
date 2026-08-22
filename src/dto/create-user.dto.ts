import { z } from 'zod';

import { UseZodSchema } from "../pipes/zod-validation.pipe.js";

const createUserSchema = z.object({
  email: z.email({ error: "must be a valid email address" }),
});

@UseZodSchema(createUserSchema)
export class CreateUserDto {
  email!: string;
}
