/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AuthForm } from "../components/auth-form";

afterEach(() => cleanup());

describe("AuthForm", () => {
  it("validates email format before submitting (login mode)", async () => {
    const onSubmit = vi.fn();
    render(
      <AuthForm mode="login" title="Login" submitLabel="Login" onSubmit={onSubmit} />
    );
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "not-email" } });
    fireEvent.change(screen.getByLabelText("Mật khẩu"), { target: { value: "abc" } });
    fireEvent.click(screen.getByRole("button", { name: "Login" }));
    await waitFor(() => expect(screen.getByText("Email không hợp lệ")).toBeTruthy());
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("rejects mismatching confirm password in register mode", async () => {
    const onSubmit = vi.fn();
    render(
      <AuthForm mode="register" title="Reg" submitLabel="Reg" onSubmit={onSubmit} />
    );
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "a@b.com" } });
    fireEvent.change(screen.getByLabelText("Mật khẩu"), { target: { value: "password1" } });
    fireEvent.change(screen.getByLabelText("Nhập lại mật khẩu"), {
      target: { value: "different" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Reg" }));
    await waitFor(() => expect(screen.getByText("Mật khẩu nhập lại không khớp")).toBeTruthy());
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("invokes onSubmit with sanitised payload and surfaces server error", async () => {
    const onSubmit = vi.fn().mockResolvedValue({ ok: false, error: "Sai mật khẩu" });
    render(
      <AuthForm mode="login" title="Login" submitLabel="Login" onSubmit={onSubmit} />
    );
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "a@b.com" } });
    fireEvent.change(screen.getByLabelText("Mật khẩu"), { target: { value: "abc" } });
    fireEvent.click(screen.getByRole("button", { name: "Login" }));
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({ email: "a@b.com", password: "abc" })
    );
    await waitFor(() => expect(screen.getByText("Sai mật khẩu")).toBeTruthy());
  });
});
