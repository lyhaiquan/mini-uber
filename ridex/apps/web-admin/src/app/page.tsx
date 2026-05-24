export default function HomePage() {
  return (
    <section className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-10 px-4 py-24 text-center">
      <div className="space-y-4">
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">RideX Admin Console</h1>
        <p className="text-surface-700 dark:text-surface-300">
          Dang nhap de xem dashboard van hanh: KPI ride, driver online, GMV, danh
          sach tai xe va khach hang.
        </p>
        <a
          href="/login"
          className="inline-flex h-11 items-center justify-center rounded-md bg-primary-500 px-6 text-base font-medium text-white transition-colors hover:bg-primary-600"
        >
          Dang nhap quan tri
        </a>
      </div>

      <div className="w-full max-w-md rounded-lg border border-surface-200 bg-surface-0 p-6 text-left shadow-sm dark:border-surface-800 dark:bg-surface-900">
        <h2 className="text-xl font-semibold leading-tight tracking-tight">Quyen truy cap</h2>
        <p className="mt-2 text-sm text-surface-700 dark:text-surface-300">
          Console chi mo cho tai khoan role{" "}
          <code className="rounded bg-surface-100 px-1 py-0.5 text-sm dark:bg-surface-800">
            ADMIN
          </code>
          . Truy cap trai phep se bi tu choi o backend.
        </p>
      </div>
    </section>
  );
}
