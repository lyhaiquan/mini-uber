export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <section className="mx-auto flex min-h-[calc(100vh-7rem)] max-w-md flex-col justify-center px-4 py-12">
      <div className="rounded-lg border border-surface-200 bg-surface-0 p-6 shadow-sm dark:border-surface-800 dark:bg-surface-900">
        {children}
      </div>
    </section>
  );
}
