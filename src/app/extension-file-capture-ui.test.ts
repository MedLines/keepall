import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { File as BrowserFile } from "node:buffer";
import { fireEvent, within, waitFor } from "@testing-library/dom";
import { afterEach, expect, test, vi } from "vitest";

const source = readFileSync("extension/file-capture.js", "utf8");
type Draft = Record<string, unknown>;
const disposals: (() => void)[] = [];
afterEach(() => { disposals.splice(0).forEach(dispose => dispose()); document.body.replaceChildren(); });
function setup(draft?: Draft, transport?: (operation: string, payload: Record<string, unknown>) => Promise<Record<string, unknown>>) {
  const request = vi.fn(transport ?? (async () => ({ success: true })));
  const urls = { createObjectURL: vi.fn(() => "blob:thumbnail"), revokeObjectURL: vi.fn() };
  const context = { document, crypto, File: BrowserFile, TextDecoder, TextEncoder, Uint8Array, URL: urls, btoa, setTimeout, clearTimeout };
  runInNewContext(source, context);
  const createNoteEditor = ({ label, content, format, onChange }: {label:string;content:string;format:string;onChange:(value:object)=>void}) => {
    const element = document.createElement("textarea"); element.setAttribute("aria-label",label); element.value=content;
    element.addEventListener("input",()=>onChange({content:element.value,format}));
    return { element, destroy() {}, setDisabled(value:boolean){element.disabled=value;} };
  };
  const factory = (context as typeof context & { __keepallCreateFileCapture: (input: object) => {
    element: HTMLElement; addFiles: (files: BrowserFile[]) => Promise<void>; paste: (event: object) => void;
    draft: () => Draft; destroy: () => void; save: () => Promise<void>; hasFiles: boolean;
  } }).__keepallCreateFileCapture;
  const onBusy=vi.fn(); const onComplete=vi.fn();
  const organization={collectionId:"reading",tagIds:["reference"]};
  const ui=factory({ document, request, draft, onBusy, onComplete, onChange:vi.fn(), createNoteEditor, sourceUrl:"https://example.com/article", getOrganization:()=>organization, pollDelay:0 });
  document.body.append(ui.element); disposals.push(ui.destroy);
  return {ui,panel:within(ui.element),request,urls,onBusy,onComplete,organization};
}
const file=(name:string,content="content",type="")=>new BrowserFile([content],name,{type});

test("stages names and sizes, requires a layout, removes files and recreates thumbnails on reopen",async()=>{
  const {ui,panel,urls}=setup(); await ui.addFiles([file("one.png","a","image/png"),file("two.png","b","image/png")]);
  expect(panel.getByText("one.png")).toBeVisible(); expect(panel.getByRole("button",{name:"One image item"})).toHaveAttribute("aria-pressed","false");
  await ui.save(); expect(panel.getByRole("alert")).toHaveTextContent("Choose");
  fireEvent.click(panel.getByRole("button",{name:"Separate image items"}));
  const draft=ui.draft(); ui.destroy(); expect(urls.revokeObjectURL).toHaveBeenCalledTimes(2);
  const reopened=setup(draft); expect(reopened.urls.createObjectURL).toHaveBeenCalledTimes(2);
  fireEvent.click(reopened.panel.getByRole("button",{name:"Remove one.png"}));
  expect(reopened.panel.queryByRole("button",{name:"One image item"})).toBeNull();
  fireEvent.click(reopened.panel.getByRole("button",{name:"Remove all files"})); expect(reopened.ui.hasFiles).toBe(false);
});

test("rejects unsupported and oversized files before upload, and only intercepts image paste",async()=>{
  const {ui,panel,request}=setup(); await ui.addFiles([file("script.exe")]); expect(panel.getByRole("alert")).toHaveTextContent("Use");
  const huge=file("huge.png","a","image/png"); Object.defineProperty(huge,"size",{value:21*1024*1024});
  await ui.addFiles([huge]); expect(panel.getByRole("alert")).toHaveTextContent("20 MiB"); expect(request).not.toHaveBeenCalled();
  const preventDefault=vi.fn(); ui.paste({clipboardData:{items:[{kind:"string",type:"text/plain"}]},preventDefault}); expect(preventDefault).not.toHaveBeenCalled();
  ui.paste({clipboardData:{items:[{kind:"file",type:"image/png",getAsFile:()=>file("pasted.png","a","image/png")}]},preventDefault});
  await waitFor(()=>expect(panel.getByText("pasted.png")).toBeVisible()); expect(preventDefault).toHaveBeenCalledOnce();
});

test("retries a lost commit reply with frozen IDs and keeps confirmed saved results",async()=>{
  let saved=false; let manifest:Record<string,unknown>; let commits=0;
  const {ui,panel,request,onComplete}=setup(undefined,async(operation,payload)=>{
    if(operation==="begin"){manifest=payload;return {success:true,sessionId:"session",stage:"receiving",results:[]};}
    if(operation==="chunk") return {success:true,stage:"receiving",receivedBytes:3};
    if(operation==="commit"){commits++;saved=true;throw new Error("Reply lost");}
    if(operation==="status")return {success:true,sessionId:"session",stage:"complete",results:saved?[{fileIndex:0,fileName:"one.txt",status:"saved",itemId:(manifest.itemIds as string[])[0]}]:[],actionId:"action"};
    return {success:true};
  });
  await ui.addFiles([file("one.txt","abc")]); await ui.save();
  expect(panel.getByRole("button",{name:"Continue import"})).toBeVisible();
  fireEvent.click(panel.getByRole("button",{name:"Continue import"}));
  await waitFor(()=>expect(onComplete).toHaveBeenCalledOnce()); expect(commits).toBe(1);
  expect(request.mock.calls.filter(([op])=>op==="begin")).toHaveLength(1);
  expect(manifest!.organization).toEqual({collectionId:"reading",tagIds:["reference"]});
});

test("a lost reply while retrying a failed session keeps edits locked and recovers the same IDs",async()=>{
  let attempts=0; let committed=false; const manifests:Record<string,unknown>[]=[];
  const {ui,panel,onBusy}=setup(undefined,async(operation,payload)=>{
    if(operation==="begin"){manifests.push(payload);attempts++;return {success:true,sessionId:`s${attempts}`,stage:"receiving",results:[]};}
    if(operation==="chunk")return {success:true};
    if(operation==="commit"){
      if(attempts===1)return {success:true,stage:"complete",results:[{fileIndex:0,status:"failed",error:"Try again"}]};
      committed=true;throw new Error("Reply lost");
    }
    return {success:true,stage:"complete",results:[{fileIndex:0,status:committed?"saved":"failed",itemId:(manifests[0].itemIds as string[])[0],error:"Try again"}]};
  });
  await ui.addFiles([file("retry.txt","abc")]); await ui.save();
  fireEvent.click(panel.getByRole("button",{name:"Retry failed files"}));
  await waitFor(()=>expect(panel.getByRole("button",{name:"Continue import"})).toBeVisible());
  expect(panel.getByRole("button",{name:"Remove all files"})).toBeDisabled(); expect(onBusy).toHaveBeenLastCalledWith(true);
  expect(manifests[1].itemIds).toEqual(manifests[0].itemIds);
  fireEvent.click(panel.getByRole("button",{name:"Continue import"}));
  await waitFor(()=>expect(panel.getByRole("status")).toHaveTextContent("1 file saved"));
  expect(manifests).toHaveLength(2);
});

test("preserves original text bytes unless edited and sends bounded acknowledged chunks",async()=>{
  const manifests:Record<string,unknown>[]=[]; const chunks:string[]=[];
  const {ui,panel}=setup(undefined,async(operation,payload)=>{
    if(operation==="begin"){manifests.push(payload);return {success:true,sessionId:"s",stage:"receiving",results:[]};}
    if(operation==="chunk"){chunks.push(payload.data as string);return {success:true};}
    return {success:true,stage:"complete",results:[{fileIndex:0,status:"saved",itemId:"id"}]};
  });
  const bytes='\ufeff# Heading\r\n'+'x'.repeat(300000); await ui.addFiles([file("original.md",bytes)]);
  expect((panel.getByRole("textbox",{name:"File contents"}) as HTMLTextAreaElement).value.slice(0,10)).toBe("# Heading\n");
  await ui.save(); expect(manifests[0].files).toEqual([{name:"original.md",type:"",size:Buffer.byteLength(bytes)}]);
  expect(chunks).toHaveLength(2); expect(Buffer.from(chunks[0],"base64").length).toBe(256*1024);
  expect(Buffer.concat(chunks.map(chunk=>Buffer.from(chunk,"base64"))).toString()).toBe(bytes);
});


test("partial failures retry only unsaved files and take a newly selected collection",async()=>{
  const manifests:Record<string,unknown>[]=[]; const sessions=new Map<string,Record<string,unknown>>(); let retrying=false;
  const {ui,panel,organization}=setup(undefined,async(operation,payload)=>{
    if(operation==="begin"){manifests.push(payload);const sessionId=String(manifests.length);sessions.set(sessionId,payload);return {success:true,sessionId,stage:"receiving",results:[]};}
    if(operation==="chunk")return {success:true};
    const manifest=sessions.get(payload.sessionId as string)!; const name=(manifest.files as {name:string}[])[0].name;
    return {success:true,stage:"complete",results:[{fileIndex:0,status:name==="good.txt"||retrying?"saved":"failed",itemId:(manifest.itemIds as string[])[0],error:"Try again"}]};
  });
  await ui.addFiles([file("good.txt"),file("bad.txt")]); await ui.save(); expect(panel.getByRole("status")).toHaveTextContent("1 of 2");
  organization.collectionId="other";retrying=true;await ui.save();
  expect(manifests).toHaveLength(3);expect(manifests[2].organization).toMatchObject({collectionId:"other"});
  expect(manifests[2].itemIds).not.toEqual(manifests[1].itemIds);
  expect(panel.getByRole("status")).toHaveTextContent("2 files saved");
});

test("waits for cancellation to settle and reports files committed before cancel",async()=>{
  let cancelled=false;let release!:()=>void;let manifest:Record<string,unknown>;
  const {ui,panel,onBusy}=setup(undefined,async(operation,payload)=>{
    if(operation==="begin"){manifest=payload;return {success:true,sessionId:"s",stage:"receiving",results:[]};}
    if(operation==="chunk")return {success:true};
    if(operation==="commit"){await new Promise<void>(resolve=>{release=resolve});return {success:true,stage:"saving",results:[]};}
    if(operation==="cancel"){cancelled=true;return {success:true,stage:"saving",results:[]};}
    return {success:true,stage:cancelled?"complete":"saving",results:cancelled?[{fileIndex:0,status:"saved",itemId:(manifest.itemIds as string[])[0]}]:[]};
  });
  await ui.addFiles([file("saved.txt")]);const saving=ui.save();await waitFor(()=>expect(release).toBeTypeOf("function"));
  fireEvent.click(panel.getByRole("button",{name:"Cancel import"}));expect(onBusy).toHaveBeenLastCalledWith(true);release();await saving;
  expect(panel.getByRole("status")).toHaveTextContent("1 file saved");expect(onBusy).toHaveBeenLastCalledWith(false);
});
