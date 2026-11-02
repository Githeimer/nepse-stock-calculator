import { Suspense } from "react";
import { UploadForm } from "./upload-form";
import { SnapshotView } from "./snapshot-view";

export default function SnapshotPage() {
  return (
    <div className="snapshot">
      <section className="snap-panel">
        <h1>Meroshare snapshot</h1>
        <p className="muted">
          Upload My Shares Values and My WACC Report from Meroshare. A new upload replaces the previous
          one.
        </p>
        <UploadForm />
      </section>
      <section className="snap-panel">
        <Suspense fallback={<p className="muted">Loading snapshot…</p>}>
          <SnapshotView />
        </Suspense>
      </section>
    </div>
  );
}