import { Library } from "./library";

export default function HomePage() {
  return (
    <main className="mx-auto max-w-xl p-6">
      <h1 className="text-3xl font-semibold tracking-tight">Keepall</h1>
      <p className="mt-2 text-sm text-zinc-600">
        Press Alt+K or ⌥K to save a link or note.
      </p>
      <Library />
    </main>
  );
}
