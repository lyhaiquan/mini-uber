"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import * as React from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { cn } from "../lib/cn";

import { Button } from "./button";
import { Input } from "./input";
import { Label } from "./label";

const loginSchema = z.object({
  email: z.string().email("Email không hợp lệ").max(254),
  password: z.string().min(1, "Mật khẩu không được trống").max(128)
});

const registerSchema = z
  .object({
    email: z.string().email("Email không hợp lệ").max(254),
    password: z.string().min(8, "Mật khẩu tối thiểu 8 ký tự").max(128),
    confirmPassword: z.string().min(1, "Vui lòng nhập lại mật khẩu")
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Mật khẩu nhập lại không khớp",
    path: ["confirmPassword"]
  });

export type AuthFormMode = "login" | "register";

export type AuthSubmitInput = { email: string; password: string };
export type AuthSubmitResult = { ok: true } | { ok: false; error: string };

interface SharedAuthFormProps {
  onSubmit: (input: AuthSubmitInput) => Promise<AuthSubmitResult>;
  title: string;
  submitLabel: string;
  switchHref?: string;
  switchLabel?: string;
  className?: string;
}

export type AuthFormProps =
  | (SharedAuthFormProps & { mode: "login" })
  | (SharedAuthFormProps & { mode: "register" });

type LoginFormValues = z.infer<typeof loginSchema>;
type RegisterFormValues = z.infer<typeof registerSchema>;

interface FormShellProps extends Omit<SharedAuthFormProps, "onSubmit"> {
  children: React.ReactNode;
  isSubmitting: boolean;
  onSubmit: React.FormEventHandler<HTMLFormElement>;
  serverError?: string;
}

function FormShell({
  children,
  className,
  isSubmitting,
  onSubmit,
  serverError,
  submitLabel,
  switchHref,
  switchLabel,
  title
}: FormShellProps) {
  return (
    <form onSubmit={onSubmit} className={cn("space-y-4", className)} noValidate>
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>

      {children}

      {serverError ? (
        <p
          className="rounded-md border border-state-error/30 bg-state-error/5 px-3 py-2 text-sm text-state-error"
          role="alert"
        >
          {serverError}
        </p>
      ) : null}

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? "Đang xử lý..." : submitLabel}
      </Button>

      {switchHref && switchLabel ? (
        <p className="text-center text-sm text-surface-700 dark:text-surface-300">
          <a className="text-primary-500 underline-offset-4 hover:underline" href={switchHref}>
            {switchLabel}
          </a>
        </p>
      ) : null}
    </form>
  );
}

function LoginAuthForm({
  onSubmit,
  title,
  submitLabel,
  switchHref,
  switchLabel,
  className
}: SharedAuthFormProps) {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting }
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" }
  });

  const submit = handleSubmit(async (data) => {
    const result = await onSubmit({ email: data.email, password: data.password });
    if (!result.ok) {
      setError("root", { type: "server", message: result.error });
    }
  });

  return (
    <FormShell
      className={className}
      isSubmitting={isSubmitting}
      onSubmit={submit}
      serverError={errors.root?.message}
      submitLabel={submitLabel}
      switchHref={switchHref}
      switchLabel={switchLabel}
      title={title}
    >
      <div className="space-y-2">
        <Label htmlFor="auth-email">Email</Label>
        <Input
          id="auth-email"
          type="email"
          autoComplete="email"
          placeholder="ban@vidu.com"
          disabled={isSubmitting}
          aria-invalid={errors.email ? "true" : undefined}
          {...register("email")}
        />
        {errors.email ? (
          <p className="text-sm text-state-error" role="alert">
            {errors.email.message}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="auth-password">Mật khẩu</Label>
        <Input
          id="auth-password"
          type="password"
          autoComplete="current-password"
          disabled={isSubmitting}
          aria-invalid={errors.password ? "true" : undefined}
          {...register("password")}
        />
        {errors.password ? (
          <p className="text-sm text-state-error" role="alert">
            {errors.password.message}
          </p>
        ) : null}
      </div>
    </FormShell>
  );
}

function RegisterAuthForm({
  onSubmit,
  title,
  submitLabel,
  switchHref,
  switchLabel,
  className
}: SharedAuthFormProps) {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting }
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { email: "", password: "", confirmPassword: "" }
  });

  const submit = handleSubmit(async (data) => {
    const result = await onSubmit({ email: data.email, password: data.password });
    if (!result.ok) {
      setError("root", { type: "server", message: result.error });
    }
  });

  return (
    <FormShell
      className={className}
      isSubmitting={isSubmitting}
      onSubmit={submit}
      serverError={errors.root?.message}
      submitLabel={submitLabel}
      switchHref={switchHref}
      switchLabel={switchLabel}
      title={title}
    >
      <div className="space-y-2">
        <Label htmlFor="auth-email">Email</Label>
        <Input
          id="auth-email"
          type="email"
          autoComplete="email"
          placeholder="ban@vidu.com"
          disabled={isSubmitting}
          aria-invalid={errors.email ? "true" : undefined}
          {...register("email")}
        />
        {errors.email ? (
          <p className="text-sm text-state-error" role="alert">
            {errors.email.message}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="auth-password">Mật khẩu</Label>
        <Input
          id="auth-password"
          type="password"
          autoComplete="new-password"
          disabled={isSubmitting}
          aria-invalid={errors.password ? "true" : undefined}
          {...register("password")}
        />
        {errors.password ? (
          <p className="text-sm text-state-error" role="alert">
            {errors.password.message}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="auth-confirm-password">Nhập lại mật khẩu</Label>
        <Input
          id="auth-confirm-password"
          type="password"
          autoComplete="new-password"
          disabled={isSubmitting}
          aria-invalid={errors.confirmPassword ? "true" : undefined}
          {...register("confirmPassword")}
        />
        {errors.confirmPassword ? (
          <p className="text-sm text-state-error" role="alert">
            {errors.confirmPassword.message}
          </p>
        ) : null}
      </div>
    </FormShell>
  );
}

export function AuthForm(props: AuthFormProps) {
  if (props.mode === "login") {
    return <LoginAuthForm {...props} />;
  }

  return <RegisterAuthForm {...props} />;
}
