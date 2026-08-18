import { NotesWorkspace } from "./notes-workspace";

export default function HomePage() {
  return (
    <main className="mx-auto max-w-xl p-6">
      <h1 className="text-3xl font-semibold tracking-tight">Keepall</h1>
      <NotesWorkspace />
    </main>
  );
}
