import { FollowListView } from "../FollowListView";

export default function FollowingPage({
  params,
}: {
  params: { id: string };
}) {
  return <FollowListView id={params.id} kind="following" />;
}
