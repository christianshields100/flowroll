import { FollowListView } from "../FollowListView";

export default function FollowersPage({
  params,
}: {
  params: { id: string };
}) {
  return <FollowListView id={params.id} kind="followers" />;
}
