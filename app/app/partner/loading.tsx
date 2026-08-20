import {
  FormCardSkeleton,
  LoadingRegion,
  PageHeaderSkeleton,
  PartnerCardSkeleton,
} from "@/components/layout/skeletons";

export default function PartnerLoading() {
  return (
    <LoadingRegion label="Partner page load ho raha hai">
      <div className="space-y-5">
        <PageHeaderSkeleton />
        <PartnerCardSkeleton />
        <FormCardSkeleton fields={1} />
      </div>
    </LoadingRegion>
  );
}
