import {
  FormCardSkeleton,
  LoadingRegion,
  PageHeaderSkeleton,
} from "@/components/layout/skeletons";

export default function AdminStorageLoading() {
  return (
    <LoadingRegion label="Storage load ho raha hai">
      <div className="space-y-5">
        <PageHeaderSkeleton />
        <FormCardSkeleton fields={2} />
        <FormCardSkeleton fields={1} />
      </div>
    </LoadingRegion>
  );
}
