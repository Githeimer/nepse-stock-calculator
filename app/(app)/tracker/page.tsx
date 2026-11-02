import { Suspense } from "react";
import { Overview, OverviewSkeleton } from "./overview";

export default function TrackerPage() {
  return (
    <>
      <h1>Portfolio</h1>
      <Suspense fallback={<OverviewSkeleton />}>
        <Overview />
      </Suspense>
    </>
  );
}