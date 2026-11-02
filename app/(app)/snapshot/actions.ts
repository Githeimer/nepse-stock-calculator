"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { parseSnapshotFiles } from "@/lib/meroshare";

export type UploadState = { error: string | null; notes: string[]; savedAt: number };

const MAX_FILE_BYTES = 512 * 1024;

export async function uploadSnapshot(_prev: UploadState, formData: FormData): Promise<UploadState> {
  const fail = (error: string): UploadState => ({ error, notes: [], savedAt: 0 });

  const files = formData
    .getAll("files")
    .filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return fail("Choose your Meroshare CSV files first.");
  if (files.length > 2) return fail("Upload two files at most: the shares file and the WACC report.");
  if (files.some((f) => f.size > MAX_FILE_BYTES)) {
    return fail("These files are much larger than Meroshare exports usually are.");
  }

  const parsed = parseSnapshotFiles(await Promise.all(files.map((f) => f.text())));
  if ("error" in parsed) return fail(parsed.error);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Your session expired. Sign in again.");

  const { data: snapshot, error: snapshotError } = await supabase
    .from("snapshots")
    .insert({ user_id: user.id })
    .select("id")
    .single();
  if (snapshotError || !snapshot) return fail(`Couldn't save the snapshot: ${snapshotError?.message}`);

  const { error: holdingsError } = await supabase.from("snapshot_holdings").insert(
    parsed.holdings.map((h) => ({
      user_id: user.id,
      snapshot_id: snapshot.id,
      symbol: h.symbol,
      quantity: h.quantity,
      wacc: h.wacc,
      wacc_quantity: h.waccQuantity,
      wacc_date: h.waccDate,
    }))
  );
  if (holdingsError) {
    await supabase.from("snapshots").delete().eq("id", snapshot.id);
    return fail(`Couldn't save the holdings: ${holdingsError.message}`);
  }

  await supabase.from("snapshots").delete().neq("id", snapshot.id);

  revalidatePath("/snapshot");
  revalidatePath("/tracker", "layout");
  return { error: null, notes: parsed.notes, savedAt: Date.now() };
}