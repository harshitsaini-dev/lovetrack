import {
  ListSkeleton,
  LoadingRegion,
  PageHeaderSkeleton,
} from "@/components/layout/skeletons";

export default function AdminSectionLoading() {
  return (
    <LoadingRegion label="Load ho raha hai">
      <div className="space-y-5">
        <PageHeaderSkeleton />
        <ListSkeleton rows={4} />
      </div>
    </LoadingRegion>
  );
}
