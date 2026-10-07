import Image from "next/image";
import libraryImage from "../../../public/marketing/app-library.webp";
import collectionImage from "../../../public/marketing/app-collection.webp";
import searchImage from "../../../public/marketing/app-search.webp";
import tagsImage from "../../../public/marketing/app-tags.webp";

const previews = {
  library: { src: libraryImage, alt: "Keepall's actual library with sample links, notes, images, PDFs, Markdown, text files, and a local video" },
  collection: { src: collectionImage, alt: "Design Inspiration selected in Keepall’s collection sidebar, showing its saved images in the library grid" },
  search: { src: searchImage, alt: "Keepall search results with highlighted matches inside saved files and recognized screenshot text" },
  tags: { src: tagsImage, alt: "Keepall filtered by the favorites tag, showing a tagged save in the real library" },
};

export function LibraryPreview({ view = "library", eager = false }: { view?: keyof typeof previews; eager?: boolean }) {
  const preview = previews[view];
  return <div className="ka-app-preview"><Image src={preview.src} alt={preview.alt} width={1440} height={860} sizes="(max-width: 520px) 670px, (max-width: 1100px) 90vw, 1040px" loading={eager ? "eager" : "lazy"} /></div>;
}
