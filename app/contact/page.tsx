export default function ContactPage() {
  const email = "agur32323@gmail.com";

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="mb-6 text-3xl font-bold">Contact</h1>

      <p className="mb-4 text-zinc-600">
        If you have questions, feedback, or need support, feel free to contact us.
      </p>

      <div className="mt-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-zinc-500">Email</p>

        <a
          href={`mailto:${email}`}
          className="text-lg font-semibold text-zinc-900 hover:underline"
        >
          {email}
        </a>

        <p className="mt-3 text-xs text-zinc-500">
          We usually respond within 24 hours.
        </p>
      </div>
    </main>
  );
}