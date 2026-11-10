import * as React from "react";
import {
  Checkbox,
  Dropdown,
  NormalPeoplePicker,
  SearchBox,
  TextField,
  type IDropdownOption,
  type IPersonaProps,
} from "@fluentui/react";
import { FieldError, FieldHint, FieldLabel } from "./Fields";
import {
  pmoCheckboxStyles,
  pmoDropdownStyles,
  pmoPeoplePickerStyles,
  pmoSearchBoxStyles,
  pmoTextFieldStyles,
  primitiveStyles,
} from "./primitiveStyles";

interface IFieldPresentationProps {
  /** Visible label and accessible name for the control. */
  readonly label: string;
  readonly id?: string;
  readonly hint?: string;
  readonly errorMessage?: string;
  readonly required?: boolean;
  readonly disabled?: boolean;
}

const describedBy = (
  hintId: string,
  errorId: string,
  hint?: string,
  error?: string,
): string | undefined =>
  [hint ? hintId : undefined, error ? errorId : undefined]
    .filter(Boolean)
    .join(" ") || undefined;

const FieldSupport = ({
  hint,
  errorMessage,
  hintId,
  errorId,
}: {
  readonly hint?: string;
  readonly errorMessage?: string;
  readonly hintId: string;
  readonly errorId: string;
}): React.ReactElement => (
  <>
    {hint ? <FieldHint id={hintId}>{hint}</FieldHint> : null}
    {errorMessage ? <FieldError id={errorId}>{errorMessage}</FieldError> : null}
  </>
);

export interface ITextInputProps extends IFieldPresentationProps {
  readonly value?: string;
  readonly placeholder?: string;
  readonly readOnly?: boolean;
  readonly onChange?: (value: string) => void;
}

/** Single-line field with standardized label, help, validation, and ARIA wiring. */
export const TextInput = ({
  label,
  id: suppliedId,
  hint,
  errorMessage,
  required,
  disabled,
  value,
  placeholder,
  readOnly,
  onChange,
}: ITextInputProps): React.ReactElement => {
  const generatedId = React.useId();
  const id = suppliedId ?? `pmo-text-${generatedId}`;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  return (
    <div className={primitiveStyles.field}>
      <FieldLabel htmlFor={id} required={required}>
        {label}
      </FieldLabel>
      <TextField
        id={id}
        aria-describedby={describedBy(hintId, errorId, hint, errorMessage)}
        invalid={Boolean(errorMessage)}
        disabled={disabled}
        readOnly={readOnly}
        required={required}
        value={value}
        placeholder={placeholder}
        styles={pmoTextFieldStyles}
        onChange={(_event, next) => onChange?.(next ?? "")}
      />
      <FieldSupport
        hint={hint}
        errorMessage={errorMessage}
        hintId={hintId}
        errorId={errorId}
      />
    </div>
  );
};

export interface ITextAreaProps extends ITextInputProps {
  readonly rows?: number;
}

/** Multi-line PMO field with controlled resizing and shared validation treatment. */
export const TextArea = ({
  rows = 4,
  ...props
}: ITextAreaProps): React.ReactElement => {
  const generatedId = React.useId();
  const id = props.id ?? `pmo-area-${generatedId}`;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  return (
    <div className={primitiveStyles.field}>
      <FieldLabel htmlFor={id} required={props.required}>
        {props.label}
      </FieldLabel>
      <TextField
        id={id}
        multiline
        rows={rows}
        resizable={false}
        aria-describedby={describedBy(
          hintId,
          errorId,
          props.hint,
          props.errorMessage,
        )}
        invalid={Boolean(props.errorMessage)}
        disabled={props.disabled}
        readOnly={props.readOnly}
        required={props.required}
        value={props.value}
        placeholder={props.placeholder}
        styles={pmoTextFieldStyles}
        onChange={(_event, next) => props.onChange?.(next ?? "")}
      />
      <FieldSupport
        hint={props.hint}
        errorMessage={props.errorMessage}
        hintId={hintId}
        errorId={errorId}
      />
    </div>
  );
};

export const normalizeNumber = (
  value: number,
  min?: number,
  max?: number,
  precision = 0,
): number => {
  const bounded = Math.min(
    max ?? Number.POSITIVE_INFINITY,
    Math.max(min ?? Number.NEGATIVE_INFINITY, value),
  );
  return Number(bounded.toFixed(Math.max(0, precision)));
};

export interface INumberInputProps extends IFieldPresentationProps {
  readonly value?: number;
  readonly min?: number;
  readonly max?: number;
  readonly precision?: number;
  readonly step?: number;
  readonly onChange?: (value: number | undefined) => void;
}

/** Numeric field that clamps min/max and rounds committed values to the requested precision. */
export const NumberInput = ({
  label,
  id: suppliedId,
  hint,
  errorMessage,
  required,
  disabled,
  value,
  min,
  max,
  precision = 0,
  step,
  onChange,
}: INumberInputProps): React.ReactElement => {
  const generatedId = React.useId();
  const id = suppliedId ?? `pmo-number-${generatedId}`;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const commit = (raw: string): void => {
    if (raw.trim() === "") return onChange?.(undefined);
    const parsed = Number(raw);
    if (!Number.isNaN(parsed))
      onChange?.(normalizeNumber(parsed, min, max, precision));
  };
  return (
    <div className={primitiveStyles.field}>
      <FieldLabel htmlFor={id} required={required}>
        {label}
      </FieldLabel>
      <TextField
        id={id}
        type="number"
        inputMode="decimal"
        min={min}
        max={max}
        step={step ?? 1 / 10 ** precision}
        value={value === undefined ? "" : value.toFixed(precision)}
        aria-describedby={describedBy(hintId, errorId, hint, errorMessage)}
        invalid={Boolean(errorMessage)}
        disabled={disabled}
        required={required}
        styles={pmoTextFieldStyles}
        onChange={(_event, next) => commit(next ?? "")}
      />
      <FieldSupport
        hint={hint}
        errorMessage={errorMessage}
        hintId={hintId}
        errorId={errorId}
      />
    </div>
  );
};

interface ITemporalInputProps extends IFieldPresentationProps {
  /** ISO date or local date-time value suitable for the native input type. */
  readonly value?: string;
  readonly min?: string;
  readonly max?: string;
  readonly onChange?: (value: string) => void;
}

const TemporalInput = ({
  type,
  label,
  id: suppliedId,
  hint,
  errorMessage,
  required,
  disabled,
  value,
  min,
  max,
  onChange,
}: ITemporalInputProps & {
  readonly type: "date" | "datetime-local";
}): React.ReactElement => {
  const generatedId = React.useId();
  const id = suppliedId ?? `pmo-${type}-${generatedId}`;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  return (
    <div className={primitiveStyles.field}>
      <FieldLabel htmlFor={id} required={required}>
        {label}
      </FieldLabel>
      <TextField
        id={id}
        type={type}
        value={value}
        min={min}
        max={max}
        aria-describedby={describedBy(hintId, errorId, hint, errorMessage)}
        invalid={Boolean(errorMessage)}
        disabled={disabled}
        required={required}
        styles={pmoTextFieldStyles}
        onChange={(_event, next) => onChange?.(next ?? "")}
      />
      <FieldSupport
        hint={hint}
        errorMessage={errorMessage}
        hintId={hintId}
        errorId={errorId}
      />
    </div>
  );
};

/** Locale-native calendar input whose value remains an unambiguous ISO date. */
export const DateInput = (props: ITemporalInputProps): React.ReactElement => (
  <TemporalInput {...props} type="date" />
);

/** Local date/time input for PMO scheduling; callers own any UTC conversion. */
export const DateTimeInput = (
  props: ITemporalInputProps,
): React.ReactElement => <TemporalInput {...props} type="datetime-local" />;

export interface ISelectInputProps extends IFieldPresentationProps {
  readonly value?: string | number;
  readonly options: readonly IDropdownOption[];
  readonly placeholder?: string;
  readonly onChange?: (key: string | number | undefined) => void;
}

/** Controlled, single-choice selection with shared validation and accessible labeling. */
export const SelectInput = ({
  label,
  id: suppliedId,
  hint,
  errorMessage,
  required,
  disabled,
  value,
  options,
  placeholder,
  onChange,
}: ISelectInputProps): React.ReactElement => {
  const generatedId = React.useId();
  const id = suppliedId ?? `pmo-select-${generatedId}`;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  return (
    <div className={primitiveStyles.field}>
      <Dropdown
        id={id}
        label={label}
        required={required}
        disabled={disabled}
        selectedKey={value}
        options={[...options]}
        placeholder={placeholder}
        aria-describedby={describedBy(hintId, errorId, hint, errorMessage)}
        errorMessage={errorMessage}
        styles={pmoDropdownStyles}
        onChange={(_event, option) => onChange?.(option?.key)}
      />
      {hint ? <FieldHint id={hintId}>{hint}</FieldHint> : null}
      {errorMessage ? (
        <span className={primitiveStyles.visuallyHidden} id={errorId}>
          {errorMessage}
        </span>
      ) : null}
    </div>
  );
};

export interface ICheckboxInputProps
  extends Omit<IFieldPresentationProps, "required"> {
  readonly checked?: boolean;
  readonly onChange?: (checked: boolean) => void;
}

/** Boolean field with an always-visible label and optional supporting text. */
export const CheckboxInput = ({
  label,
  id: suppliedId,
  hint,
  errorMessage,
  disabled,
  checked,
  onChange,
}: ICheckboxInputProps): React.ReactElement => {
  const generatedId = React.useId();
  const id = suppliedId ?? `pmo-checkbox-${generatedId}`;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  return (
    <div className={primitiveStyles.field}>
      <Checkbox
        id={id}
        label={label}
        checked={checked}
        disabled={disabled}
        ariaDescribedBy={describedBy(hintId, errorId, hint, errorMessage)}
        inputProps={{ "aria-invalid": Boolean(errorMessage) }}
        styles={pmoCheckboxStyles}
        onChange={(_event, next) => onChange?.(Boolean(next))}
      />
      <FieldSupport
        hint={hint}
        errorMessage={errorMessage}
        hintId={hintId}
        errorId={errorId}
      />
    </div>
  );
};

export interface IPmoPerson extends IPersonaProps {
  readonly id: string;
  readonly email: string;
}

export interface IPersonInputProps extends IFieldPresentationProps {
  readonly selectedPeople?: readonly IPmoPerson[];
  readonly onResolveSuggestions: (
    query: string,
    selectedPeople: readonly IPmoPerson[],
  ) => IPmoPerson[] | PromiseLike<IPmoPerson[]>;
  readonly onChange?: (people: readonly IPmoPerson[]) => void;
  readonly itemLimit?: number;
}

/** M365 people picker boundary. The host supplies SharePoint/Microsoft 365 resolution; this component performs no data calls. */
export const PersonInput = ({
  label,
  hint,
  errorMessage,
  required,
  disabled,
  selectedPeople = [],
  onResolveSuggestions,
  onChange,
  itemLimit = 1,
}: IPersonInputProps): React.ReactElement => {
  const generatedId = React.useId();
  const hintId = `pmo-person-${generatedId}-hint`;
  const errorId = `pmo-person-${generatedId}-error`;
  return (
    <div className={primitiveStyles.field}>
      <FieldLabel required={required}>{label}</FieldLabel>
      <NormalPeoplePicker
        aria-label={label}
        selectedItems={[...selectedPeople]}
        itemLimit={itemLimit}
        disabled={disabled}
        resolveDelay={300}
        onResolveSuggestions={(query, current) =>
          onResolveSuggestions(query, (current ?? []) as IPmoPerson[])
        }
        onChange={(people) => onChange?.((people ?? []) as IPmoPerson[])}
        getTextFromItem={(person) => person.text ?? ""}
        removeButtonAriaLabel="Remove person"
        styles={pmoPeoplePickerStyles}
        pickerSuggestionsProps={{
          suggestionsHeaderText: "Suggested people",
          noResultsFoundText: "No people found",
          loadingText: "Searching people",
        }}
        inputProps={{
          "aria-describedby": describedBy(hintId, errorId, hint, errorMessage),
          "aria-invalid": Boolean(errorMessage),
          "aria-required": required,
        }}
      />
      <FieldSupport
        hint={hint}
        errorMessage={errorMessage}
        hintId={hintId}
        errorId={errorId}
      />
    </div>
  );
};

export interface ISearchInputProps {
  readonly label: string;
  readonly value?: string;
  readonly placeholder?: string;
  readonly disabled?: boolean;
  readonly debounceMs?: number;
  readonly onChange?: (value: string) => void;
  readonly onSearch: (value: string) => void;
}

/** Search control that centralizes accessible naming and cancellable debounce behavior. */
export const SearchInput = ({
  label,
  value,
  placeholder,
  disabled,
  debounceMs = 300,
  onChange,
  onSearch,
}: ISearchInputProps): React.ReactElement => {
  const timer = React.useRef<ReturnType<typeof setTimeout>>();
  React.useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const queueSearch = (next: string): void => {
    onChange?.(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => onSearch(next), debounceMs);
  };
  return (
    <SearchBox
      ariaLabel={label}
      value={value}
      placeholder={placeholder}
      disabled={disabled}
      styles={pmoSearchBoxStyles}
      onChange={(_event, next) => queueSearch(next ?? "")}
      onSearch={queueSearch}
      onClear={() => queueSearch("")}
    />
  );
};
