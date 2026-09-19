import { SearchResults } from "@/components/search-results";
import { SiteFooter } from "@/components/landing-sections";
import { SiteHeader } from "@/components/site-header";

export default async function SearchPage(props: PageProps<"/search">) {
  const { q } = await props.searchParams;
  const query = (typeof q === "string" ? q : "").trim().slice(0, 100);

  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <SearchResults key={query} query={query} />
      </main>
      <SiteFooter />
    </>
  );
}
