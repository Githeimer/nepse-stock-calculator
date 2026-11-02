"use client";

import { useActionState } from "react";
import { uploadSnapshot, type UploadState } from "./actions";

const initialState: UploadState = { error: null, notes: [], savedAt: 0 };

export function UploadForm() {
  const [state, formAction, pending] = useActionState(uploadSnapshot, initialState);

  return (
    <form action={formAction} className="upload">
      <label className="field">
        Meroshare CSV files
        <input name="files" type="file" accept=".csv,text/csv" multiple required />
      </label>
      <button className="btn primary" type="submit" disabled={pending}>
        {pending ? "Uploading…" : "Upload"}
      </button>
      {state.error && (
        <p className="error" role="alert">
          {state.error}
        </p>
      )}
      {!state.error && state.savedAt > 0 && (
        <div className="upload-result">
          <p className="gain">Snapshot saved.</p>
          {state.notes.map((note) => (
            <p key={note} className="muted small">
              {note}
            </p>
          ))}
        </div>
      )}
    </form>
  );
}