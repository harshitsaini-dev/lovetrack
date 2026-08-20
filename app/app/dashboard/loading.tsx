import {
  LoadingRegion,
  PageHeaderSkeleton,
  TimelineSkeleton,
  TodayCardSkeleton,
} from "@/components/layout/skeletons";

export default function DashboardLoading() {
  return (
    <LoadingRegion label="Dashboard load ho raha hai">
      <div className="space-y-5">
        <PageHeaderSkeleton />
        <TodayCardSkeleton />
        <TimelineSkeleton />
      </div>
    </LoadingRegion>
  );
}
