import { redirect } from "next/navigation";

export default function TrashPage() {
  redirect("/?trash=1");
}
