import Image from "next/image";
import {
  CollectionIcon,
  GridIcon,
  HashIcon,
  InboxIcon,
  LayersIcon,
  LightThemeIcon,
  LinkIcon,
  ListIcon,
  LogoIcon,
  PanelIcon,
  PlusIcon,
  SearchIcon,
  SortDescIcon,
} from "../shell-icons";

type PreviewItem = {
  image: string;
  imageAlt: string;
  ratio: string;
  host?: string;
  title?: string;
  description?: string;
  tags?: number;
  filename?: string;
};

const columns: PreviewItem[][] = [
  [
    { image: "/marketing/workflow-canvas.svg", imageAlt: "A connected workflow on a lavender canvas", ratio: "1.4", tags: 3 },
    { image: "/marketing/night-product.svg", imageAlt: "A dark purple product website", ratio: "0.9", filename: "Product idea.jpg" },
  ],
  [
    { image: "/marketing/studio-interface.svg", imageAlt: "An interface design workspace", ratio: "1.4", host: "studio.example", title: "A workspace for every idea", description: "Collect, connect, and shape your next project.", tags: 2 },
    { image: "/marketing/editorial-page.svg", imageAlt: "An editorial page about interior design", ratio: "1.45", filename: "Editorial layout.jpg" },
  ],
  [
    { image: "/marketing/ideas-page.svg", imageAlt: "An editorial website about useful design", ratio: "1.45", host: "commonplace.example", title: "Ideas for a more useful web", description: "Thoughts on making everyday tools feel more human.", tags: 2 },
    { image: "/marketing/type-study.svg", imageAlt: "A typography study with large serif letters", ratio: "1.42", filename: "Type study.jpg" },
    { image: "/marketing/architecture.webp", imageAlt: "Warm architectural forms", ratio: "1.5", filename: "Afternoon light.jpg" },
  ],
  [
    { image: "/marketing/signal-landing.svg", imageAlt: "A violet product landing page", ratio: "1.35", filename: "Landing page.jpg" },
    { image: "/marketing/reading-corner.webp", imageAlt: "A quiet reading corner", ratio: "1.3", filename: "Quiet spaces.jpg" },
    { image: "/marketing/color-atlas.svg", imageAlt: "A warm color palette study", ratio: "1.4", filename: "Color atlas.jpg" },
  ],
];

function PreviewCard({ item }: { item: PreviewItem }) {
  return (
    <div className="library-card squircle-panel rounded-card p-card-inset about-preview-card">
      <div className="library-card-media squircle-panel about-preview-media" style={{ aspectRatio: item.ratio }}>
        <Image src={item.image} alt={item.imageAlt} fill sizes="(max-width: 640px) 45vw, (max-width: 1000px) 30vw, 260px" className="object-cover" />
      </div>
      {item.host || item.title || item.filename || item.tags ? (
        <div className="about-preview-card-copy">
          {item.host ? <p className="about-preview-source"><LinkIcon className="size-3.5" /> {item.host}</p> : null}
          {item.title ? <h3>{item.title}</h3> : null}
          {item.description ? <p className="about-preview-description">{item.description}</p> : null}
          {item.filename ? <p className="about-preview-filename">{item.filename}</p> : null}
          {item.tags ? <span className="about-preview-tag"><HashIcon className="size-3" /> {item.tags} tags</span> : null}
        </div>
      ) : null}
    </div>
  );
}

export function LibraryPreview() {
  return (
    <div className="about-product-preview" role="img" aria-label="Example Keepall library showing a Design Inspiration collection with a sidebar and masonry grid of saved websites and images">
      <div className="about-preview-stage">
        <div className="about-preview-app" aria-hidden="true">
        <aside className="about-preview-sidebar">
          <div className="about-preview-brand"><LogoIcon className="size-5" /> keepall</div>
          <div className="about-preview-nav-row"><LayersIcon className="size-3.5" /> All items <span>734</span></div>
          <div className="about-preview-nav-row"><InboxIcon className="size-3.5" /> Unsorted <span>34</span></div>
          <div className="about-preview-nav-heading"><CollectionIcon className="size-3.5" /> Collections</div>
          <div className="about-preview-sidebar-search"><SearchIcon className="size-3" /> Search folders</div>
          <div className="about-preview-nav-row about-preview-nav-current"><i className="about-preview-dot about-preview-dot-orange" /> Design Inspiration <span>395</span></div>
          <div className="about-preview-nav-row"><i className="about-preview-dot about-preview-dot-green" /> Coding and Learning <span>20</span></div>
          <div className="about-preview-nav-row"><i className="about-preview-dot about-preview-dot-blue" /> After effects <span>8</span></div>
          <div className="about-preview-nav-row"><i className="about-preview-dot about-preview-dot-purple" /> Bookmarks bar <span>9</span></div>
          <div className="about-preview-nav-heading about-preview-tags-heading"><HashIcon className="size-3.5" /> Tags (5)</div>
        </aside>
        <div className="about-preview-content">
          <div className="about-preview-toolbar">
            <div className="about-preview-search"><PanelIcon className="size-4" /><span><SearchIcon className="size-3.5" /> Search your library…</span></div>
            <div className="about-preview-toolbar-right"><span className="about-preview-round-control"><LightThemeIcon className="size-4" /></span><span className="about-preview-save"><PlusIcon className="size-3.5" /> Save item</span></div>
          </div>
          <div className="about-preview-heading"><div><strong>Design Inspiration</strong><span className="about-preview-count">395</span></div><div className="about-preview-layout-controls"><LayersIcon className="size-4" /><SortDescIcon className="size-4" /><GridIcon className="size-4" /><ListIcon className="size-4" /></div></div>
          <div className="about-preview-cards">
            {columns.map((column, index) => <div className="about-preview-column" key={index}>{column.map((item, cardIndex) => <PreviewCard item={item} key={cardIndex} />)}</div>)}
          </div>
        </div>
        </div>
      </div>
      <span className="about-preview-caption">A peek inside a personal library</span>
    </div>
  );
}
