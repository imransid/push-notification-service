import { ValidateBy, ValidationOptions, buildMessage } from 'class-validator';

export function IsStringRecord(options?: ValidationOptions) {
  return ValidateBy(
    {
      name: 'isStringRecord',
      validator: {
        validate: (value: unknown) =>
          typeof value === 'object' &&
          value !== null &&
          !Array.isArray(value) &&
          Object.values(value).every((v) => typeof v === 'string'),
        defaultMessage: buildMessage(
          (each) => each + '$property values must all be strings',
          options,
        ),
      },
    },
    options,
  );
}
