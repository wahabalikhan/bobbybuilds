import { JOURNEY_BODY_MAX } from "@/lib/journey-types";
import { TextArea } from "./form";

/** The entry's few sentences. Bold, italic and links still work (sanitised by renderMarkdown on the public pages); the hint stays short. */
export function JourneyBody({ defaultValue }: { defaultValue: string }) {
	return <TextArea name="body_md" label="Text" rows={4} maxLength={JOURNEY_BODY_MAX} defaultValue={defaultValue} hint={`Up to ${JOURNEY_BODY_MAX} characters.`} />;
}
