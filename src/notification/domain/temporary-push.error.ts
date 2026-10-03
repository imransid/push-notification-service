export class TemporaryPushError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TemporaryPushError';
  }
}
