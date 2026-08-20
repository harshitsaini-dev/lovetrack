import {
  ListSkeleton,
  LoadingRegion,
  PageHeaderSkeleton,
} from "@/components/layout/skeletons";

export default function PartnerHistoryLoading() {
  return (
    <LoadingRegion label="Partner history load ho rahi hai">
      <div className="space-y-5">
        <PageHeaderSkeleton />
        <ListSkeleton rows={4} />
      </div>
    </LoadingRegion>
  );
}
