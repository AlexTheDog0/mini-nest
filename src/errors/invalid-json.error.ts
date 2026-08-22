export class InvalidJsonError extends Error {
  constructor() {
    super("Invalid JSON body");
  }
}
