"use client";

import { Slot } from "@radix-ui/react-slot";
import * as React from "react";
import {
  Controller,
  type ControllerProps,
  type FieldPath,
  type FieldValues,
  FormProvider,
  useFormContext,
  useFormState,
} from "react-hook-form";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils/cn";

const Form = FormProvider;

type FormFieldContextValue<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> = {
  name: TName;
};

const FormFieldContext = React.createContext<FormFieldContextValue | null>(null);

const FormField = <TFieldValues extends FieldValues, TName extends FieldPath<TFieldValues>>({
  ...props
}: ControllerProps<TFieldValues, TName>) => {
  return (
    <FormFieldContext.Provider value={{ name: props.name }}>
      <Controller {...props} />
    </FormFieldContext.Provider>
  );
};

const useFormField = () => {
  const fieldContext = React.useContext(FormFieldContext);
  const itemContext = React.useContext(FormItemContext);
  const { getFieldState } = useFormContext();
  const formState = useFormState(fieldContext ? { name: fieldContext.name } : {});

  if (!fieldContext) {
    throw new Error("useFormField must be used within <FormField>.");
  }

  const fieldState = getFieldState(fieldContext.name, formState);
  const { id } = itemContext;

  return {
    id,
    name: fieldContext.name,
    formItemId: `${id}-form-item`,
    formDescriptionId: `${id}-form-item-description`,
    formMessageId: `${id}-form-item-message`,
    ...fieldState,
  };
};

type FormItemContextValue = {
  id: string;
};

const FormItemContext = React.createContext<FormItemContextValue>({
  id: "",
});

function FormItem({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>): React.JSX.Element {
  const id = React.useId();

  return (
    <FormItemContext.Provider value={{ id }}>
      <div className={cn("space-y-2", className)} {...props} />
    </FormItemContext.Provider>
  );
}

function FormLabel({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof Label>): React.JSX.Element {
  const { error, formItemId } = useFormField();

  return (
    <Label
      className={cn(error ? "text-danger-text" : undefined, className)}
      htmlFor={formItemId}
      {...props}
    />
  );
}

function FormControl({ ...props }: React.ComponentPropsWithoutRef<typeof Slot>): React.JSX.Element {
  const { error, formItemId, formDescriptionId, formMessageId } = useFormField();

  return (
    <Slot
      id={formItemId}
      aria-describedby={error ? `${formDescriptionId} ${formMessageId}` : formDescriptionId}
      aria-invalid={Boolean(error)}
      {...props}
    />
  );
}

function FormDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>): React.JSX.Element {
  const { formDescriptionId } = useFormField();

  return (
    <p id={formDescriptionId} className={cn("text-sm text-brand-mocha/80", className)} {...props} />
  );
}

function FormMessage({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>): React.JSX.Element | null {
  const { error, formMessageId } = useFormField();
  const body = error ? String(error.message) : children;

  if (!body) {
    return null;
  }

  return (
    <p
      id={formMessageId}
      role="alert"
      className={cn("text-sm font-medium text-danger-text", className)}
      {...props}
    >
      {body}
    </p>
  );
}

export {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  useFormField,
};
