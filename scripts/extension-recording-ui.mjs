// Read bounds inside the real extension's closed shadow root without changing it.
export async function extensionRecordingUi(context, page, move, xdo) {
  const cdp = await context.newCDPSession(page);
  async function find(selector, text) {
    const { root } = await cdp.send("DOM.getDocument", { depth: 1, pierce: true });
    const { nodeId } = await cdp.send("DOM.querySelector", { nodeId: root.nodeId, selector: "#keepall-capture-ui" });
    if (!nodeId) return null;
    const { node } = await cdp.send("DOM.describeNode", { nodeId, depth: 1, pierce: true });
    const shadow = node.shadowRoots?.[0];
    if (!shadow) return null;
    const { object } = await cdp.send("DOM.resolveNode", { backendNodeId: shadow.backendNodeId });
    try {
      const { result } = await cdp.send("Runtime.callFunctionOn", {
        objectId: object.objectId,
        // Notices render in an iframe inside the shadow root, so they stay above website pop-ups; search it too.
        functionDeclaration: `function(selector, text) {
          const scopes = [{ root: this, x: 0, y: 0 }];
          for (const frame of this.querySelectorAll('iframe')) {
            if (!frame.contentDocument) continue;
            const box = frame.getBoundingClientRect();
            scopes.push({ root: frame.contentDocument, x: box.x + frame.clientLeft, y: box.y + frame.clientTop });
          }
          for (const scope of scopes) {
            const element = [...scope.root.querySelectorAll(selector)].find(el => !text || el.textContent.includes(text));
            if (!element) continue;
            const rect = element.getBoundingClientRect();
            const style = element.ownerDocument.defaultView.getComputedStyle(element);
            if (!rect.width || !rect.height || style.visibility === 'hidden' || element.disabled) continue;
            return {x:scope.x+rect.x+rect.width/2,y:scope.y+rect.y+rect.height/2,text:element.textContent};
          }
          return null;
        }`,
        arguments: [{ value: selector }, { value: text ?? "" }], returnByValue: true,
      });
      return result.value;
    } finally { await cdp.send("Runtime.releaseObject", { objectId: object.objectId }); }
  }
  async function wait(selector, text) {
    for (let attempt = 0; attempt < 100; attempt++) {
      const element = await find(selector, text);
      if (element) return element;
      await page.waitForTimeout(100);
    }
    throw new Error(`Extension control unavailable: ${selector} ${text ?? ""}`);
  }
  async function click(selector, text) {
    const element = await wait(selector, text);
    const top = await page.evaluate(() => outerHeight - innerHeight);
    await move(element.x, element.y + top);
    await page.waitForTimeout(180);
    xdo("click", 1);
  }
  return { wait, click };
}
