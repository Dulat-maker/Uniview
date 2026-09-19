import { notFound } from "next/navigation";
import { SiteFooter } from "@/components/landing-sections";
import { SiteHeader } from "@/components/site-header";
import { UniversityProfileView } from "@/components/university/profile-view";

export default async function UniversityPage(props: PageProps<"/university/[qid]">) {
  const { qid } = await props.params;
  if (!/^Q\d{1,12}$/.test(qid)) notFound();

  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <UniversityProfileView key={qid} qid={qid} />
      </main>
      <SiteFooter />
    </>
  );
}
