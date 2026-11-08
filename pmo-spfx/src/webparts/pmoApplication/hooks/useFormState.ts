import * as React from "react";

export type PmoFormErrors<T extends object> = Partial<Record<keyof T, string>>;

export interface IUseFormStateResult<T extends object> {
  readonly values: T;
  readonly errors: PmoFormErrors<T>;
  readonly touched: ReadonlySet<keyof T>;
  readonly isDirty: boolean;
  readonly setValue: <K extends keyof T>(key: K, value: T[K]) => void;
  readonly setErrors: (errors: PmoFormErrors<T>) => void;
  readonly touch: (key: keyof T) => void;
  readonly validate: () => boolean;
  readonly reset: (values?: T) => void;
}

/** Small typed state helper; domain forms remain responsible for fields and validation rules. */
export const useFormState = <T extends object>(
  initialValues: T,
  validator?: (values: T) => PmoFormErrors<T>,
): IUseFormStateResult<T> => {
  const initial = React.useRef(initialValues);
  const [values, setValues] = React.useState(initialValues);
  const [errors, setErrors] = React.useState<PmoFormErrors<T>>({});
  const [touched, setTouched] = React.useState<ReadonlySet<keyof T>>(new Set());
  const setValue = React.useCallback(
    <K extends keyof T>(key: K, value: T[K]): void => {
      setValues((current) => ({ ...current, [key]: value }));
    },
    [],
  );
  const touch = React.useCallback((key: keyof T): void => {
    setTouched((current) => new Set(current).add(key));
  }, []);
  const validate = React.useCallback((): boolean => {
    const nextErrors: PmoFormErrors<T> = validator?.(values) ?? {};
    setErrors(nextErrors);
    return (Object.keys(nextErrors) as (keyof T)[]).every(
      (key) => !nextErrors[key],
    );
  }, [validator, values]);
  const reset = React.useCallback((nextValues?: T): void => {
    const next = nextValues ?? initial.current;
    initial.current = next;
    setValues(next);
    setErrors({});
    setTouched(new Set());
  }, []);
  return {
    values,
    errors,
    touched,
    isDirty: JSON.stringify(values) !== JSON.stringify(initial.current),
    setValue,
    setErrors,
    touch,
    validate,
    reset,
  };
};
