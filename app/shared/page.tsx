import { SiteFooter } from "@/components/landing-sections";
import { SharedView } from "@/components/shared-view";
import { SiteHeader } from "@/components/site-header";

export default function SharedPage() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <SharedView />
      </main>
      <SiteFooter />
    </>
  );
}
