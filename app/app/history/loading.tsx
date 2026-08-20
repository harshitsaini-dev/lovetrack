import {
  ListSkeleton,
  LoadingRegion,
  PageHeaderSkeleton,
} from "@/components/layout/skeletons";

export default function HistoryLoading() {
  return (
    <LoadingRegion label="History load ho rahi hai">
      <div className="space-y-5">
        <PageHeaderSkeleton />
        <ListSkeleton rows={5} />
      </div>
    </LoadingRegion>
  );
}
