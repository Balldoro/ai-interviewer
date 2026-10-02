import { Field, FieldLabel, FieldLegend, FieldSet } from '@/components/ui/field';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

type RadioFieldSetProps<Value extends string> = {
  id: string;
  legend: string;
  name: string;
  options: readonly Value[];
  labels: Record<Value, string>;
  defaultValue: Value;
  className: string;
};

export function RadioFieldSet<Value extends string>({
  id,
  legend,
  name,
  options,
  labels,
  defaultValue,
  className,
}: RadioFieldSetProps<Value>) {
  return (
    <FieldSet>
      <FieldLegend id={id}>{legend}</FieldLegend>
      <RadioGroup
        aria-labelledby={id}
        name={name}
        defaultValue={defaultValue}
        className={className}
      >
        {options.map((option) => {
          const itemId = `${id}-${option}`;
          return (
            <FieldLabel key={option} htmlFor={itemId}>
              <Field orientation="horizontal">
                <RadioGroupItem id={itemId} value={option} />
                {labels[option]}
              </Field>
            </FieldLabel>
          );
        })}
      </RadioGroup>
    </FieldSet>
  );
}
