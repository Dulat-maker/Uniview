import { SiteFooter } from "@/components/landing-sections";
import { SavedView } from "@/components/saved-view";
import { SiteHeader } from "@/components/site-header";

export default function SavedPage() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <SavedView />
      </main>
      <SiteFooter />
    </>
  );
}
