import { Suspense } from "react";
import { SettingsLoader } from "./settings-loader";

export default function SettingsPage() {
  return (
    <div className="settings">
      <h1>Fee and tax settings</h1>
      <p className="muted">
        These rates pre-fill new buys and sales. Transactions you've already saved keep the amounts they
        were saved with.
      </p>
      <Suspense fallback={<p className="muted">Loading settings…</p>}>
        <SettingsLoader />
      </Suspense>
    </div>
  );
}