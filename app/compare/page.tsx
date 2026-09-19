import { CompareView } from "@/components/compare/compare-view";
import { SiteFooter } from "@/components/landing-sections";
import { SiteHeader } from "@/components/site-header";

const QID = /^Q\d{1,12}$/;
// Same limit as MAX_COMPARE in compare-view: a constant exported from a client module
// arrives on the server as a client reference, not as the number.
const MAX_COMPARE = 4;

/** `?ids=Q1,Q2,Q3` (up to 4); the older `?a=Q1&b=Q2` links keep working. */
function parseIds(params: Record<string, string | string[] | undefined>) {
  const raw = [
    ...(typeof params.ids === "string" ? params.ids.split(",") : []),
    ...[params.a, params.b].filter((v): v is string => typeof v === "string"),
  ];
  return [...new Set(raw.map((v) => v.trim()).filter((v) => QID.test(v)))].slice(0, MAX_COMPARE);
}

export default async function ComparePage(props: PageProps<"/compare">) {
  const ids = parseIds(await props.searchParams);

  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <CompareView key={ids.join(",")} ids={ids} />
      </main>
      <SiteFooter />
    </>
  );
}
