import { useRef, useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Menu } from "@base-ui/react/menu";
import { expect, userEvent, within } from "storybook/test";
import { CardSource } from "@/app/library-card-details";
import { ItemTypeBadge } from "@/app/item-type-icon";
import { RowActionMenu } from "@/app/row-action-menu";
import { CloseIcon, CollectionIcon, DeviceIcon, EditIcon, EyeIcon, MoreIcon, PinIcon } from "@/app/shell-icons";
import { Button, IconButton } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { menuItemClassName } from "@/components/ui/menu-item";
import { ModalDialog } from "@/components/ui/modal-dialog";
import { TextField } from "@/components/ui/text-field";
import { itemsByType } from "../../.storybook/fixtures";

// ItemTypeBadge needs a full library item; the docs only show the shared fixtures, so each sample
// borrows a fixture of the right type for its glyph and keeps its own invented title and source.
function typeFixture(pattern: RegExp) {
  const entry = itemsByType.find(({ name }) => pattern.test(name));
  if (!entry) throw new Error(`No item fixture matches ${pattern}`);
  return entry.item;
}

type SampleItem = {
  id: string;
  title: string;
  kind: RegExp;
  url?: string;
  savedAt: string;
};

const sampleItems: SampleItem[] = [
  { id: "cliff-path", title: "Cliff path from Harrow Point to Gull Bay", kind: /^link$/i, url: "https://trailnotes.example/harrow-point", savedAt: "2026-11-12" },
  { id: "tide-times", title: "Tide times for the north shore", kind: /^note/i, savedAt: "2026-11-10" },
  { id: "ferry", title: "Summer ferry timetable", kind: /pdf/i, savedAt: "2026-11-07" },
  { id: "lighthouse", title: "Lighthouse at dusk", kind: /^image$/i, url: "https://harbourphotos.example/lighthouse", savedAt: "2026-10-28" },
  { id: "packing", title: "Packing list for overnight hikes", kind: /^note/i, savedAt: "2026-10-19" },
];

function ItemSource({ url }: { url?: string }) {
  if (url) return <CardSource url={url} />;
  return (
    <span className="flex items-center gap-1 text-meta text-text-secondary">
      <DeviceIcon className="size-4" />
      On this device
    </span>
  );
}

function RecentItemRow({ item, onRemove }: { item: SampleItem; onRemove: () => void }) {
  const triggerRef = useRef<HTMLButtonElement>(null);

  return (
    <RowActionMenu
      label={`Actions for ${item.title}`}
      triggerRef={triggerRef}
      trigger={
        <IconButton aria-label="More actions" size="sm">
          <MoreIcon />
        </IconButton>
      }
      menu={() => (
        <>
          <Menu.Item className={menuItemClassName()}>
            <EyeIcon />
            Open
          </Menu.Item>
          <Menu.Item className={menuItemClassName()}>
            <EditIcon />
            Edit
          </Menu.Item>
          <Menu.Item className={menuItemClassName()}>
            <PinIcon />
            Pin to top
          </Menu.Item>
          <Menu.Item className={menuItemClassName()} onClick={onRemove}>
            <CloseIcon />
            Remove from collection
          </Menu.Item>
        </>
      )}
    >
      {(trigger) => (
        <li className="flex items-center justify-between gap-3 rounded-panel bg-bg-raised px-4 py-3">
          <div className="grid min-w-0 gap-1">
            <span className="truncate text-sm font-medium text-text-primary">{item.title}</span>
            <span className="flex min-w-0 items-center gap-2">
              <ItemTypeBadge item={typeFixture(item.kind)} variant="list" />
              <ItemSource url={item.url} />
            </span>
          </div>
          {trigger}
        </li>
      )}
    </RowActionMenu>
  );
}

function CollectionDetails() {
  const [name, setName] = useState("Coastal walks");
  const [draftName, setDraftName] = useState(name);
  const [items, setItems] = useState(sampleItems);
  const [otherItemCount] = useState(9);
  const [renaming, setRenaming] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleted, setDeleted] = useState(false);

  const count = items.length + otherItemCount;
  const recent = [...items].sort((a, b) => b.savedAt.localeCompare(a.savedAt)).slice(0, 3);

  if (deleted) {
    return (
      <section className="grid w-full max-w-xl justify-items-start gap-3 rounded-panel bg-bg-surface p-6">
        <p className="text-sm text-text-secondary">“{name}” was deleted. Its items stay in your library.</p>
        <Button onClick={() => setDeleted(false)}>Reset prototype</Button>
      </section>
    );
  }

  return (
    <section aria-labelledby="collection-name" className="grid w-full max-w-xl gap-6 rounded-panel bg-bg-surface p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <CollectionIcon className="size-5 shrink-0 text-text-secondary" />
          <div className="grid min-w-0 gap-1">
            <h2 id="collection-name" className="truncate text-heading font-semibold text-text-primary">
              {name}
            </h2>
            <p className="text-sm text-text-secondary">
              {count} {count === 1 ? "item" : "items"}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => {
              setDraftName(name);
              setRenaming(true);
            }}
          >
            Rename
          </Button>
          <Button variant="danger-ghost" onClick={() => setConfirmingDelete(true)}>
            Delete collection
          </Button>
        </div>
      </div>

      <div className="grid gap-3">
        <h3 className="text-sm font-medium text-text-secondary">Recently saved</h3>
        {recent.length > 0 ? (
          <ul className="grid gap-2">
            {recent.map((item) => (
              <RecentItemRow
                key={item.id}
                item={item}
                onRemove={() => setItems((current) => current.filter((entry) => entry.id !== item.id))}
              />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-text-secondary">Nothing saved here yet.</p>
        )}
      </div>

      <ModalDialog
        open={renaming}
        onOpenChange={setRenaming}
        title="Rename collection"
        description="Collections group items you want to find together."
        footer={
          <>
            <Button onClick={() => setRenaming(false)}>Cancel</Button>
            <Button variant="primary" type="submit" disabled={draftName.trim() === ""}>
              Save
            </Button>
          </>
        }
        onSubmit={() => {
          const next = draftName.trim();
          if (!next) return;
          setName(next);
          setRenaming(false);
        }}
      >
        <TextField label="Name" value={draftName} onChange={(event) => setDraftName(event.target.value)} />
      </ModalDialog>

      <ConfirmDialog
        open={confirmingDelete}
        title={`Delete “${name}”?`}
        description="The collection is removed from this device. Its items stay in your library."
        confirmLabel="Delete collection"
        onConfirm={() => {
          setConfirmingDelete(false);
          setDeleted(true);
        }}
        onOpenChange={setConfirmingDelete}
      />
    </section>
  );
}

function PrototypeNotes() {
  const used = [
    "Button (secondary, primary, danger-ghost)",
    "IconButton (size sm, as the row's More trigger)",
    "RowActionMenu with Base UI Menu.Item and menuItemClassName()",
    "ModalDialog (compact, with onSubmit)",
    "TextField",
    "ConfirmDialog",
    "ItemTypeBadge (list variant)",
    "CardSource",
    "Icons: CollectionIcon, DeviceIcon, MoreIcon, EyeIcon, EditIcon, PinIcon, CloseIcon",
  ];
  const builtByHand = [
    "Collection panel: section on bg-bg-surface with rounded-panel and p-6",
    "Collection header: folder glyph, text-heading name and item count beside the Rename and Delete buttons",
    "Recent item row: title over a type-and-source line, More button at the end, on bg-bg-raised",
    "Local source line: DeviceIcon plus “On this device” in 11px secondary text",
    "Recently saved section heading and its empty-state line",
    "Deleted state with a Reset prototype button",
  ];
  const suggested = [
    "ItemSource: one component for “where it came from” that picks CardSource for websites and a device line for files and notes, so the local wording and glyph stay consistent.",
    "CompactItemRow: a small item row (title, type badge, source, action menu) for panels and popovers; the library list row is larger and the parts here are composed by hand.",
    "ItemTypeBadge and ItemTypeIcon taking a type instead of a whole item, so prototypes and small surfaces don't need a full library record or the Storybook fixtures.",
    "PanelHeader: title, meta line and trailing actions; collection, tag and settings panels all need the same arrangement.",
  ];

  return (
    <section aria-labelledby="prototype-notes" className="grid w-full max-w-xl gap-4">
      <h2 id="prototype-notes" className="text-md font-semibold text-text-primary">
        Prototype notes
      </h2>
      {[
        { heading: "Used", entries: used },
        { heading: "Built by hand", entries: builtByHand },
        { heading: "Suggested components", entries: suggested },
      ].map(({ heading, entries }) => (
        <div key={heading} className="grid gap-2">
          <h3 className="text-sm font-medium text-text-primary">{heading}</h3>
          <ul className="grid list-disc gap-1 pl-5 text-sm text-text-secondary">
            {entries.map((entry) => (
              <li key={entry}>{entry}</li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}

function CollectionDetailsPrototype() {
  return (
    <div className="grid gap-10">
      <CollectionDetails />
      <PrototypeNotes />
    </div>
  );
}

const meta = {
  title: "Prototypes/Collection details",
  component: CollectionDetailsPrototype,
} satisfies Meta<typeof CollectionDetailsPrototype>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const RenameCollection: Story = {
  play: async ({ canvas, canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole("button", { name: "Rename" }));
    const field = await page.findByLabelText("Name");
    await userEvent.clear(field);
    await userEvent.type(field, "Shoreline walks");
    await userEvent.click(page.getByRole("button", { name: "Save" }));
    await expect(await canvas.findByRole("heading", { name: "Shoreline walks" })).toBeInTheDocument();
  },
};

export const DeleteAsksFirst: Story = {
  play: async ({ canvas, canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole("button", { name: "Delete collection" }));
    await expect(await page.findByText("Delete “Coastal walks”?")).toBeInTheDocument();
    await userEvent.click(page.getByRole("button", { name: "Cancel" }));
    await expect(canvas.getByRole("heading", { name: "Coastal walks" })).toBeInTheDocument();
  },
};

export const RemoveFromCollection: Story = {
  play: async ({ canvas, canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);
    await expect(canvas.getByText("14 items")).toBeInTheDocument();
    const [firstMore] = canvas.getAllByRole("button", { name: "More actions" });
    await userEvent.click(firstMore);
    await userEvent.click(await page.findByRole("menuitem", { name: "Remove from collection" }));
    await expect(await canvas.findByText("13 items")).toBeInTheDocument();
    await expect(canvas.queryByText("Cliff path from Harrow Point to Gull Bay")).not.toBeInTheDocument();
  },
};
