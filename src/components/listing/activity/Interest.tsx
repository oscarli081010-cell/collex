import { todayInSydney } from "@/lib/conferences";
import InterestChart from "../../InterestChart";
import Section from "../Section";
import type { ListingCtx } from "../types";
import m from "../../Manage.module.css";

// How many people said they were interested, week by week.
export default function Interest({ ctx }: { ctx: ListingCtx }) {
  const { c, interest } = ctx.data;
  return (
    <Section id="sec-interest" title="Interest over time">
      {c.interestUrl
        ? <p className={m.note}>People are sent to your own interest form, so Collex has no count to show. Clear the link in the listing to use Collex&rsquo;s button instead.</p>
        : ctx.live
          ? <InterestChart weeks={interest.weeks} total={interest.total} today={todayInSydney()} />
          : <p className={m.note}>Interest starts counting once the listing is live.</p>}
    </Section>
  );
}
