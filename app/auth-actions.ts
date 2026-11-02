"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type SignInState = { error: string | null; email: string };

export async function signIn(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    return { error: "Email or password is incorrect.", email };
  }

  // Create the fee settings row on first sign-in. Defaults come from the table.
  await supabase
    .from("fee_settings")
    .upsert({ user_id: data.user.id }, { onConflict: "user_id", ignoreDuplicates: true });

  revalidatePath("/", "layout");
  redirect("/tracker");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}