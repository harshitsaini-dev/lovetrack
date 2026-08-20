import {
  FormCardSkeleton,
  LoadingRegion,
  PageHeaderSkeleton,
} from "@/components/layout/skeletons";

export default function SettingsLoading() {
  return (
    <LoadingRegion label="Settings load ho rahi hain">
      <div className="space-y-5">
        <PageHeaderSkeleton />
        <FormCardSkeleton fields={1} />
        <FormCardSkeleton fields={2} />
        <FormCardSkeleton fields={3} />
      </div>
    </LoadingRegion>
  );
}
