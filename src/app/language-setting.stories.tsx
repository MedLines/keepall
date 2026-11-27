import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { userEvent, within } from "storybook/test";
import { LANGUAGES } from "@/i18n/locales";
import { LanguageSetting } from "./language-setting";

// The toolbar's Language picks what the row shows; choosing here saves the preference but the
// toolbar still wins, so switch languages from the toolbar.
const meta = {
  title: "Settings/LanguageSetting",
  component: LanguageSetting,
  args: { languages: LANGUAGES },
  decorators: [(Story) => <div className="w-[min(36rem,90vw)]"><Story /></div>],
} satisfies Meta<typeof LanguageSetting>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const PseudoLocale: Story = { globals: { language: "en-XA" } };
export const Open: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("combobox"));
  },
};
/** One language available, as in production today: the row is not rendered. */
export const SingleLanguage: Story = { args: { languages: ["en"] } };
