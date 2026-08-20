import {
  CaptureSkeleton,
  LoadingRegion,
  PageHeaderSkeleton,
} from "@/components/layout/skeletons";

export default function CaptureLoading() {
  return (
    <LoadingRegion label="Load ho raha hai">
      <div className="space-y-5">
        <PageHeaderSkeleton />
        <CaptureSkeleton />
      </div>
    </LoadingRegion>
  );
}
